# Original procedural monsters: rigid-skinned primitive parts + small armatures + keyframed actions.
# Bones all point +Z so local axes match world axes (X = right, Y = up-the-bone/world Z, Z = world -Y = forward).
# Euler keys are (x, y, z) in degrees around the bone's local axes: x = pitch, y = yaw (world Z), z = roll (forward axis).
import math
import bpy
from mathutils import Vector
import kk
from kk import ellipsoid, box, cone, cylinder, tube, torus, plate, FLAT, OUT, reset, join, export_glb
from accessories import glow

def make_rig(name, bones):
    data = bpy.data.armatures.new(name); arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, parent, head in bones:
        eb = data.edit_bones.new(bname); eb.head = Vector(head); eb.tail = Vector(head) + Vector((0, 0, 0.2))
        if parent: eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones: pb.rotation_mode = 'XYZ'
    return arm

def finish(name, arm, parts):
    mat = bpy.data.materials.new(f'{name}_mat')
    for o in parts:
        o.data.materials.clear(); o.data.materials.append(mat)
        o.modifiers.new('Armature', 'ARMATURE').object = arm
        o.parent = arm
    body = join(parts, parts[0]); body.name = name
    return body

def anim(arm, name, length, keys, loop=False):
    """keys: {bone: [(frame, {'r': (x,y,z) deg local, 'l': (x,y,z) world offset, 's': (x,y,z) world or float}), ...]}"""
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    for bone, frames in keys.items():
        pb = arm.pose.bones[bone]
        for f, k in frames:
            if 'r' in k:
                pb.rotation_euler = [math.radians(a) for a in k['r']]; pb.keyframe_insert('rotation_euler', frame=f)
            if 'l' in k:  # authored in world axes (x right, y back, z up); pose-bone local is (x, up, forward)
                x, y, z = k['l']; pb.location = (x, z, -y); pb.keyframe_insert('location', frame=f)
            if 's' in k:
                s = k['s']; pb.scale = (s, s, s) if isinstance(s, (int, float)) else (s[0], s[2], s[1]); pb.keyframe_insert('scale', frame=f)
    act.frame_range = (0, length)
    act.use_frame_range = True
    act.use_cyclic = loop
    track = arm.animation_data.nla_tracks.new(); track.name = name
    track.strips.new(name, 0, act)
    arm.animation_data.action = None
    return act

def cyc(frames, a, b, n=2):
    """Alternate value a/b across a loop of `frames` frames (n half cycles), returning [(f, v)] incl. closing key."""
    step = frames / n
    return [(round(i * step), a if i % 2 == 0 else b) for i in range(n + 1)]

def rot_keys(frames, a, b, n=2):
    return [(f, {'r': v}) for f, v in cyc(frames, a, b, n)]

# ---------------------------------------------------------------- slime
def slime(name='slime', G=(0.32, 0.85, 0.36), D=(0.12, 0.38, 0.16), acid=False):
    arm = make_rig(name, [('root', None, (0, 0, 0)), ('body', 'root', (0, 0, 0))])
    p = [ellipsoid('body', (0, 0, 0.6), (0.78, 0.74, 0.6), G, glow(0.12) if acid else FLAT, 'body', seg=18, rings=12),
         ellipsoid('shine', (-0.28, -0.34, 0.98), (0.17, 0.09, 0.1), (0.85, 1, 0.85), FLAT, 'body', seg=8, rings=5),
         ellipsoid('crown', (0, 0.05, 1.12), (0.16, 0.16, 0.14), G, FLAT, 'body', seg=10, rings=6)]
    for s in (-1, 1):
        p += [ellipsoid(f'eye{s}', (s * 0.24, -0.6, 0.74), (0.14, 0.09, 0.18), (1, 1, 1), FLAT, 'body', seg=10, rings=6),
              ellipsoid(f'pupil{s}', (s * 0.22, -0.68, 0.72), (0.07, 0.04, 0.09), (0.05, 0.05, 0.08), FLAT, 'body', seg=8, rings=5)]
    p.append(ellipsoid('mouth', (0, -0.68, 0.47), (0.14, 0.04, 0.05), D, FLAT, 'body', seg=8, rings=4))
    if acid:  # corrosive bubbles, angry brows and a half-dissolved skull inside the jelly
        for i, (x, y, z, r) in enumerate(((0.42, -0.35, 0.95, 0.09), (-0.5, -0.2, 0.82, 0.07), (0.15, 0.45, 1.05, 0.11), (-0.3, 0.4, 0.98, 0.08), (0.6, 0.2, 0.62, 0.07), (-0.05, -0.2, 1.17, 0.06))):
            p.append(ellipsoid(f'bubble{i}', (x, y, z), (r, r, r), (0.95, 1.0, 0.55), glow(0.6), 'body', seg=8, rings=5))
        for sd in (-1, 1):
            p.append(box(f'brow{sd}', (sd * 0.24, -0.66, 0.92), (0.24, 0.05, 0.06), D, FLAT, 'body', rot=(0, -sd * 22, 0)))
        p.append(ellipsoid('skull', (0.1, 0.1, 0.55), (0.2, 0.18, 0.18), (0.92, 0.9, 0.78), FLAT, 'body', seg=8, rings=6))
    for i in range(7):
        a = 2 * math.pi * i / 7 + 0.3
        p.append(ellipsoid(f'drip{i}', (math.cos(a) * 0.72, math.sin(a) * 0.7, 0.1), (0.16, 0.16, 0.11), G, FLAT, 'body', seg=8, rings=5))
    body = finish(name, arm, p)
    S = lambda z, xy: {'s': (xy, xy, z)}
    anim(arm, 'Idle', 40, {'body': [(0, S(1, 1)), (20, S(0.9, 1.06)), (40, S(1, 1))]}, True)
    anim(arm, 'Walk', 24, {'root': [(0, {'l': (0, 0, 0)}), (12, {'l': (0, 0, 0.55)}), (24, {'l': (0, 0, 0)})],
                           'body': [(0, S(0.78, 1.15)), (5, S(1.18, 0.9)), (12, S(1.05, 0.96)), (20, S(0.95, 1.02)), (24, S(0.78, 1.15))]}, True)
    anim(arm, 'Attack', 30, {'root': [(0, {'l': (0, 0, 0)}), (10, {'l': (0, 0.25, 0)}), (16, {'l': (0, -0.7, 0.45)}), (20, {'l': (0, -0.8, 0)}), (30, {'l': (0, 0, 0)})],
                             'body': [(0, S(1, 1)), (10, S(0.8, 1.12)), (16, S(1.25, 0.85)), (20, S(0.62, 1.32)), (30, S(1, 1))]})
    anim(arm, 'Hit', 12, {'body': [(0, S(1, 1)), (3, S(0.68, 1.22)), (12, S(1, 1))]})
    anim(arm, 'Death', 24, {'body': [(0, S(1, 1)), (6, S(1.2, 0.9)), (18, S(0.12, 1.7)), (24, S(0.06, 1.8))]})
    anim(arm, 'Spawn', 20, {'body': [(0, S(0.05, 0.05)), (14, S(1.15, 1.1)), (20, S(1, 1))]})
    return arm, body

# ---------------------------------------------------------------- vampire bat
def vampire_bat(name='vampire_bat', F=(0.24, 0.13, 0.3), M=(0.42, 0.16, 0.36), B=(0.36, 0.22, 0.4), EYE=(1, 0.12, 0.08), shadow=False):
    Z = 1.35
    arm = make_rig(name, [('root', None, (0, 0, 0)), ('body', 'root', (0, 0, Z)), ('head', 'body', (0, -0.25, Z + 0.15)),
                                    ('wing_l', 'body', (0.22, 0, Z + 0.1)), ('tip_l', 'wing_l', (0.85, 0.02, Z + 0.15)),
                                    ('wing_r', 'body', (-0.22, 0, Z + 0.1)), ('tip_r', 'wing_r', (-0.85, 0.02, Z + 0.15))])
    p = [ellipsoid('body', (0, 0, Z), (0.27, 0.3, 0.34), F, FLAT, 'body', seg=12, rings=8),
         ellipsoid('belly', (0, -0.14, Z - 0.05), (0.18, 0.18, 0.24), B, FLAT, 'body', seg=10, rings=6),
         ellipsoid('head', (0, -0.3, Z + 0.22), (0.22, 0.21, 0.2), F, FLAT, 'head', seg=12, rings=8),
         ellipsoid('snout', (0, -0.48, Z + 0.17), (0.09, 0.07, 0.07), B, FLAT, 'head', seg=8, rings=5)]
    for s in (-1, 1):
        p += [cone(f'ear{s}', (s * 0.12, -0.28, Z + 0.36), (s * 0.4, 0.1, 1), 0.08, 0.26, F, FLAT, 'head', seg=5),
              ellipsoid(f'eye{s}', (s * 0.1, -0.47, Z + 0.28), (0.05, 0.03, 0.04), EYE, glow(1), 'head', seg=8, rings=5),
              cone(f'fang{s}', (s * 0.05, -0.52, Z + 0.12), (0, -0.2, -1), 0.025, 0.09, (1, 1, 0.95), FLAT, 'head', seg=4),
              cone(f'foot{s}', (s * 0.1, 0.05, Z - 0.32), (0, 0, -1), 0.05, 0.14, B, FLAT, 'body', seg=4)]
        w, t = ('wing_l', 'tip_l') if s > 0 else ('wing_r', 'tip_r')
        p += [plate(f'membrane{s}', [(s * 0.2, 0.06, Z + 0.28), (s * 0.85, 0.06, Z + 0.3), (s * 0.85, 0.06, Z - 0.12), (s * 0.55, 0.06, Z - 0.02), (s * 0.2, 0.06, Z - 0.2)], (0, 1, 0), 0.025, M, FLAT, w),
              plate(f'membraneTip{s}', [(s * 0.85, 0.06, Z + 0.3), (s * 1.4, 0.06, Z + 0.25), (s * 1.28, 0.06, Z + 0.02), (s * 1.08, 0.06, Z - 0.05), (s * 0.85, 0.06, Z - 0.12)], (0, 1, 0), 0.025, M, FLAT, t),
              cylinder(f'bone{s}', (s * 0.22, 0.04, Z + 0.28), (s * 0.85, 0.04, Z + 0.3), 0.03, F, FLAT, w),
              cylinder(f'boneTip{s}', (s * 0.85, 0.04, Z + 0.3), (s * 1.4, 0.04, Z + 0.25), 0.025, F, FLAT, t),
              cone(f'claw{s}', (s * 0.85, 0.03, Z + 0.32), (s * 0.2, 0, 1), 0.035, 0.12, (0.9, 0.85, 0.8), FLAT, w, seg=4)]
        for k in range(3):
            p.append(cone(f'scallop{s}{k}', (s * (0.95 + k * 0.17), 0.06, Z - 0.1), (0, 0, -1), 0.07, 0.12, M, FLAT, t, seg=4))
    if shadow:  # void core, glowing wing veins and a spiked crest
        p.append(ellipsoid('core', (0, -0.2, Z - 0.02), (0.11, 0.08, 0.12), EYE, glow(0.9), 'body', seg=8, rings=6))
        for s in (-1, 1):
            w, t = ('wing_l', 'tip_l') if s > 0 else ('wing_r', 'tip_r')
            p += [cylinder(f'vein{s}', (s * 0.3, 0.035, Z + 0.22), (s * 0.78, 0.035, Z - 0.08), 0.015, EYE, glow(0.6), w, seg=4),
                  cylinder(f'veinTip{s}', (s * 0.9, 0.035, Z + 0.24), (s * 1.25, 0.035, Z + 0.02), 0.013, EYE, glow(0.6), t, seg=4)]
        for k in range(3):
            p.append(cone(f'crest{k}', (0, -0.22 + k * 0.1, Z + 0.4 - k * 0.04), (0, 0.5, 1), 0.04, 0.2 - k * 0.04, F, FLAT, 'head', seg=4))
    body = finish(name, arm, p)
    up, down = 42, -34
    flap = lambda n: {'wing_l': rot_keys(n, (0, 0, down), (0, 0, up)), 'wing_r': rot_keys(n, (0, 0, -down), (0, 0, -up)),
                      'tip_l': rot_keys(n, (0, 0, -18), (0, 0, 25)), 'tip_r': rot_keys(n, (0, 0, 18), (0, 0, -25)),
                      'body': [(f, {'l': (0, 0, v)}) for f, v in cyc(n, 0.08, -0.06)]}
    anim(arm, 'Idle', 16, flap(16), True)
    anim(arm, 'Walk', 12, flap(12), True)
    k = flap(20); k['root'] = [(0, {'l': (0, 0, 0)}), (8, {'l': (0, 0.2, 0.25)}), (13, {'l': (0, -0.9, -0.55)}), (20, {'l': (0, 0, 0)})]
    k['body'] = [(0, {'r': (0, 0, 0)}), (8, {'r': (-25, 0, 0)}), (13, {'r': (35, 0, 0)}), (20, {'r': (0, 0, 0)})]
    anim(arm, 'Attack', 20, k)
    anim(arm, 'Hit', 10, {'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (3, {'r': (-30, 0, 15), 'l': (0, 0.25, 0.1)}), (10, {'r': (0, 0, 0), 'l': (0, 0, 0)})]})
    anim(arm, 'Death', 30, {'root': [(0, {'l': (0, 0, 0), 'r': (0, 0, 0)}), (24, {'l': (0, 0, -1.2), 'r': (0, 540, 0)}), (30, {'l': (0, 0, -1.25), 'r': (0, 560, 0)})],
                            'wing_l': [(0, {'r': (0, 0, 0)}), (20, {'r': (0, 0, -70)})], 'wing_r': [(0, {'r': (0, 0, 0)}), (20, {'r': (0, 0, 70)})],
                            'body': [(0, {'r': (0, 0, 0)}), (30, {'r': (80, 0, 0)})]})
    anim(arm, 'Spawn', 18, {'root': [(0, {'s': 0.05}), (12, {'s': 1.15}), (18, {'s': 1})], **{k2: v for k2, v in flap(18).items() if k2 != 'body'}})
    return arm, body

# ---------------------------------------------------------------- gargoyle
def gargoyle():
    arm = make_rig('gargoyle', [('root', None, (0, 0, 0)), ('hips', 'root', (0, 0, 0.95)), ('chest', 'hips', (0, -0.05, 1.35)), ('head', 'chest', (0, -0.35, 1.8)),
                                 ('arm_l', 'chest', (0.55, -0.05, 1.6)), ('arm_r', 'chest', (-0.55, -0.05, 1.6)), ('leg_l', 'hips', (0.3, 0, 0.85)), ('leg_r', 'hips', (-0.3, 0, 0.85)),
                                 ('wing_l', 'chest', (0.3, 0.35, 1.75)), ('wing_r', 'chest', (-0.3, 0.35, 1.75)), ('tail', 'hips', (0, 0.35, 0.9))])
    S = (0.52, 0.52, 0.58); Dk = (0.34, 0.34, 0.4); E = (1.0, 0.55, 0.1); H = (0.82, 0.78, 0.7)
    p = [box('hips', (0, 0.02, 0.98), (0.62, 0.46, 0.36), Dk, FLAT, 'hips', bevel=0.06),
         ellipsoid('chest', (0, -0.05, 1.48), (0.55, 0.44, 0.48), S, FLAT, 'chest', seg=10, rings=7, rot=(15, 0, 0), smooth=False),
         ellipsoid('belly', (0, -0.3, 1.32), (0.32, 0.18, 0.28), Dk, FLAT, 'chest', seg=8, rings=6, smooth=False),
         ellipsoid('head', (0, -0.42, 1.88), (0.3, 0.3, 0.27), S, FLAT, 'head', seg=9, rings=6, smooth=False),
         box('jaw', (0, -0.6, 1.74), (0.34, 0.2, 0.12), Dk, FLAT, 'head', bevel=0.03)]
    for s in (-1, 1):
        side = 'l' if s > 0 else 'r'
        p += [ellipsoid(f'eye{s}', (s * 0.13, -0.68, 1.92), (0.07, 0.04, 0.045), E, glow(1), 'head', seg=8, rings=5),
              tube(f'horn{s}', [(s * 0.18, -0.38, 2.08), (s * 0.3, -0.3, 2.3), (s * 0.34, -0.15, 2.45), (s * 0.3, 0.02, 2.52)], [0.08, 0.06, 0.04, 0.02], H, FLAT, 'head'),
              cone(f'fang{s}', (s * 0.1, -0.68, 1.72), (0, 0, 1), 0.03, 0.1, H, FLAT, 'head', seg=4),
              ellipsoid(f'shoulder{s}', (s * 0.58, -0.05, 1.68), (0.24, 0.24, 0.2), Dk, FLAT, f'arm_{side}', seg=8, rings=5, smooth=False),
              ellipsoid(f'upper{s}', (s * 0.66, -0.08, 1.35), (0.15, 0.15, 0.3), S, FLAT, f'arm_{side}', seg=8, rings=5, smooth=False),
              ellipsoid(f'fore{s}', (s * 0.7, -0.18, 0.98), (0.14, 0.14, 0.28), S, FLAT, f'arm_{side}', seg=8, rings=5, smooth=False),
              ellipsoid(f'hand{s}', (s * 0.72, -0.25, 0.7), (0.15, 0.13, 0.12), Dk, FLAT, f'arm_{side}', seg=8, rings=5, smooth=False),
              ellipsoid(f'thigh{s}', (s * 0.32, -0.02, 0.62), (0.19, 0.21, 0.3), S, FLAT, f'leg_{side}', seg=8, rings=5, smooth=False),
              box(f'foot{s}', (s * 0.33, -0.12, 0.14), (0.24, 0.42, 0.18), Dk, FLAT, f'leg_{side}', bevel=0.04),
              cylinder(f'wingbone{s}', (s * 0.3, 0.38, 1.78), (s * 1.15, 0.6, 2.35), 0.05, Dk, FLAT, f'wing_{side}'),
              plate(f'wingm{s}', [(s * 0.3, 0.4, 1.78), (s * 1.15, 0.6, 2.35), (s * 1.25, 0.6, 1.95), (s * 1.0, 0.55, 1.7), (s * 0.8, 0.5, 1.45), (s * 0.55, 0.45, 1.4)], (0, 1, 0), 0.03, (0.4, 0.38, 0.45), FLAT, f'wing_{side}'),
              cone(f'wingclaw{s}', (s * 1.15, 0.6, 2.35), (s * 0.3, 0, 1), 0.05, 0.18, H, FLAT, f'wing_{side}', seg=4)]
        for k in range(3):
            p.append(cone(f'claw{s}{k}', (s * (0.66 + 0.06 * k), -0.32, 0.62), (0, -0.4, -1), 0.035, 0.16, H, FLAT, f'arm_{side}', seg=4))
            p.append(cone(f'toe{s}{k}', (s * (0.25 + 0.08 * k), -0.34, 0.1), (0, -1, -0.2), 0.04, 0.14, H, FLAT, f'leg_{side}', seg=4))
    p.append(tube('tail', [(0, 0.3, 0.9), (0, 0.65, 0.7), (0, 0.95, 0.55), (0, 1.25, 0.55)], [0.09, 0.07, 0.05, 0.03], Dk, FLAT, 'tail'))
    p.append(cone('tailspike', (0, 1.25, 0.55), (0, 1, 0.2), 0.08, 0.22, H, FLAT, 'tail', seg=4))
    body = finish('gargoyle', arm, p)
    anim(arm, 'Idle', 40, {'chest': rot_keys(40, (0, 0, 0), (6, 0, 0)), 'wing_l': rot_keys(40, (0, 0, 0), (0, 0, 10)), 'wing_r': rot_keys(40, (0, 0, 0), (0, 0, -10)),
                           'hips': [(f, {'l': (0, 0, v)}) for f, v in cyc(40, 0, -0.04)]}, True)
    anim(arm, 'Walk', 24, {'leg_l': rot_keys(24, (30, 0, 0), (-30, 0, 0)), 'leg_r': rot_keys(24, (-30, 0, 0), (30, 0, 0)),
                           'arm_l': rot_keys(24, (-25, 0, 0), (25, 0, 0)), 'arm_r': rot_keys(24, (25, 0, 0), (-25, 0, 0)),
                           'hips': [(f, {'l': (0, 0, v)}) for f, v in cyc(24, 0, 0.08, 4)], 'chest': rot_keys(24, (12, 0, 4), (12, 0, -4)),
                           'wing_l': rot_keys(24, (0, 0, 5), (0, 0, 20)), 'wing_r': rot_keys(24, (0, 0, -5), (0, 0, -20)), 'tail': rot_keys(24, (0, 15, 0), (0, -15, 0))}, True)
    anim(arm, 'Attack', 30, {'arm_l': [(0, {'r': (0, 0, 0)}), (12, {'r': (-150, 0, -10)}), (18, {'r': (40, 0, 0)}), (30, {'r': (0, 0, 0)})],
                             'arm_r': [(0, {'r': (0, 0, 0)}), (12, {'r': (-150, 0, 10)}), (18, {'r': (40, 0, 0)}), (30, {'r': (0, 0, 0)})],
                             'chest': [(0, {'r': (0, 0, 0)}), (12, {'r': (-20, 0, 0)}), (18, {'r': (30, 0, 0)}), (30, {'r': (0, 0, 0)})],
                             'wing_l': [(0, {'r': (0, 0, 0)}), (12, {'r': (0, 0, 35)}), (30, {'r': (0, 0, 0)})], 'wing_r': [(0, {'r': (0, 0, 0)}), (12, {'r': (0, 0, -35)}), (30, {'r': (0, 0, 0)})]})
    anim(arm, 'Hit', 12, {'chest': [(0, {'r': (0, 0, 0)}), (3, {'r': (-18, 0, 8)}), (12, {'r': (0, 0, 0)})], 'head': [(0, {'r': (0, 0, 0)}), (3, {'r': (-20, 0, 0)}), (12, {'r': (0, 0, 0)})]})
    anim(arm, 'Death', 36, {'hips': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (24, {'r': (70, 0, 0), 'l': (0, -0.4, -0.55)}), (36, {'r': (85, 0, 0), 'l': (0, -0.5, -0.7)})],
                            'root': [(0, {'s': 1}), (26, {'s': 1}), (36, {'s': 0.85})], 'wing_l': [(0, {'r': (0, 0, 0)}), (30, {'r': (0, 0, -40)})], 'wing_r': [(0, {'r': (0, 0, 0)}), (30, {'r': (0, 0, 40)})]})
    anim(arm, 'Spawn', 30, {'hips': [(0, {'l': (0, 0, -0.7), 'r': (40, 0, 0)}), (20, {'l': (0, 0, 0.1), 'r': (-10, 0, 0)}), (30, {'l': (0, 0, 0), 'r': (0, 0, 0)})],
                            'wing_l': [(0, {'r': (0, 0, -30)}), (20, {'r': (0, 0, 40)}), (30, {'r': (0, 0, 0)})], 'wing_r': [(0, {'r': (0, 0, 30)}), (20, {'r': (0, 0, -40)}), (30, {'r': (0, 0, 0)})]})
    return arm, body

# ---------------------------------------------------------------- lava imp
def lava_imp():
    arm = make_rig('lava_imp', [('root', None, (0, 0, 0)), ('body', 'root', (0, 0, 0.6)), ('head', 'body', (0, -0.1, 1.0)), ('arm_l', 'body', (0.3, -0.05, 0.85)), ('arm_r', 'body', (-0.3, -0.05, 0.85)),
                                 ('leg_l', 'body', (0.17, 0, 0.45)), ('leg_r', 'body', (-0.17, 0, 0.45)), ('tail', 'body', (0, 0.25, 0.55))])
    R = (0.17, 0.09, 0.07); L = (1.0, 0.42, 0.06); Y = (1.0, 0.85, 0.2)
    p = [ellipsoid('body', (0, 0, 0.68), (0.33, 0.28, 0.36), R, FLAT, 'body', seg=9, rings=6, smooth=False),
         ellipsoid('head', (0, -0.14, 1.1), (0.3, 0.27, 0.25), R, FLAT, 'head', seg=9, rings=6, smooth=False),
         ellipsoid('mouth', (0, -0.38, 1.01), (0.14, 0.04, 0.04), L, glow(1), 'head', seg=8, rings=4)]
    for i, (x, z, rz) in enumerate(((0.08, 0.75, 20), (-0.12, 0.62, -30), (0.15, 0.5, 60), (-0.05, 0.9, -10))):
        p.append(box(f'crack{i}', (x, -0.27, z), (0.2, 0.02, 0.035), L, glow(0.9), 'body', rot=(0, rz, 0)))
    for s in (-1, 1):
        side = 'l' if s > 0 else 'r'
        p += [ellipsoid(f'eye{s}', (s * 0.11, -0.36, 1.16), (0.07, 0.03, 0.06), Y, glow(1), 'head', seg=8, rings=5),
              tube(f'horn{s}', [(s * 0.17, -0.1, 1.28), (s * 0.3, -0.05, 1.42), (s * 0.34, 0.06, 1.55)], [0.06, 0.04, 0.02], (0.12, 0.08, 0.07), FLAT, 'head'),
              ellipsoid(f'arm{s}', (s * 0.4, -0.08, 0.68), (0.08, 0.08, 0.22), R, FLAT, f'arm_{side}', seg=6, rings=4, smooth=False),
              cone(f'clawA{s}', (s * 0.42, -0.14, 0.46), (s * 0.2, -0.5, -1), 0.03, 0.12, L, glow(0.8), f'arm_{side}', seg=4),
              cone(f'clawB{s}', (s * 0.38, -0.1, 0.46), (0, -0.3, -1), 0.03, 0.12, L, glow(0.8), f'arm_{side}', seg=4),
              ellipsoid(f'leg{s}', (s * 0.17, 0, 0.25), (0.1, 0.11, 0.22), R, FLAT, f'leg_{side}', seg=6, rings=4, smooth=False),
              box(f'foot{s}', (s * 0.18, -0.08, 0.05), (0.14, 0.24, 0.1), (0.1, 0.06, 0.05), FLAT, f'leg_{side}', bevel=0.02)]
    p.append(tube('tail', [(0, 0.25, 0.55), (0, 0.5, 0.45), (0, 0.72, 0.6), (0, 0.82, 0.82)], [0.06, 0.05, 0.04, 0.03], R, FLAT, 'tail'))
    p.append(cone('tailflame', (0, 0.82, 0.82), (0, 0.2, 1), 0.09, 0.26, L, glow(1), 'tail', seg=5))
    body = finish('lava_imp', arm, p)
    anim(arm, 'Idle', 20, {'body': [(f, {'l': (0, 0, v)}) for f, v in cyc(20, 0, 0.04)], 'tail': rot_keys(20, (0, 20, 0), (0, -20, 0)), 'head': rot_keys(20, (0, 10, 0), (0, -10, 0))}, True)
    anim(arm, 'Walk', 14, {'leg_l': rot_keys(14, (40, 0, 0), (-40, 0, 0)), 'leg_r': rot_keys(14, (-40, 0, 0), (40, 0, 0)), 'arm_l': rot_keys(14, (-35, 0, 0), (35, 0, 0)), 'arm_r': rot_keys(14, (35, 0, 0), (-35, 0, 0)),
                           'body': [(f, {'l': (0, 0, v), 'r': (18, 0, 0)}) for f, v in cyc(14, 0, 0.09, 4)], 'tail': rot_keys(14, (0, 25, 0), (0, -25, 0))}, True)
    anim(arm, 'Attack', 18, {'arm_r': [(0, {'r': (0, 0, 0)}), (6, {'r': (-130, 0, -30)}), (10, {'r': (50, 0, 20)}), (18, {'r': (0, 0, 0)})],
                             'arm_l': [(0, {'r': (0, 0, 0)}), (8, {'r': (-120, 0, 30)}), (12, {'r': (50, 0, -20)}), (18, {'r': (0, 0, 0)})],
                             'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (6, {'r': (-15, 0, 0), 'l': (0, 0.1, 0)}), (11, {'r': (25, 0, 0), 'l': (0, -0.35, 0)}), (18, {'r': (0, 0, 0), 'l': (0, 0, 0)})]})
    anim(arm, 'Hit', 10, {'body': [(0, {'r': (0, 0, 0)}), (3, {'r': (-25, 0, 10)}), (10, {'r': (0, 0, 0)})]})
    anim(arm, 'Death', 20, {'root': [(0, {'s': 1}), (8, {'s': 1.35}), (20, {'s': 0.02})], 'body': [(0, {'r': (0, 0, 0)}), (20, {'r': (0, 0, 180)})]})
    anim(arm, 'Spawn', 16, {'root': [(0, {'l': (0, 0, -1.0), 's': 0.6}), (10, {'l': (0, 0, 0.3), 's': 1.1}), (16, {'l': (0, 0, 0), 's': 1})]})
    return arm, body

# ---------------------------------------------------------------- thorn treant
def thorn_treant():
    arm = make_rig('thorn_treant', [('root', None, (0, 0, 0)), ('trunk', 'root', (0, 0, 0.5)), ('upper', 'trunk', (0, 0, 1.4)), ('crown', 'upper', (0, 0, 2.3)),
                                     ('arm_l', 'upper', (0.5, 0, 1.85)), ('arm_r', 'upper', (-0.5, 0, 1.85)), ('leg_l', 'trunk', (0.32, 0, 0.5)), ('leg_r', 'trunk', (-0.32, 0, 0.5))])
    W = (0.42, 0.28, 0.17); Wd = (0.28, 0.18, 0.11); Lf = (0.3, 0.62, 0.22); Lf2 = (0.42, 0.75, 0.25); T = (0.85, 0.8, 0.6); E = (0.5, 1.0, 0.35); Bl = (1.0, 0.55, 0.75)
    p = [cylinder('trunkLow', (0, 0, 0.45), (0, 0, 1.45), 0.5, W, FLAT, 'trunk', seg=9),
         cylinder('trunkHigh', (0, 0, 1.4), (0, 0, 2.3), 0.44, W, FLAT, 'upper', seg=9),
         ellipsoid('mouth', (0, -0.42, 1.55), (0.2, 0.06, 0.12), (0.08, 0.05, 0.03), FLAT, 'upper', seg=8, rings=5)]
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.5
        p.append(tube(f'bark{i}', [(math.cos(a) * 0.48, math.sin(a) * 0.48, 0.5), (math.cos(a + 0.15) * 0.47, math.sin(a + 0.15) * 0.47, 1.2), (math.cos(a + 0.05) * 0.43, math.sin(a + 0.05) * 0.43, 2.0)], [0.06, 0.05, 0.03], Wd, FLAT, 'trunk', seg=5))
    for i, (x, y, z, r) in enumerate(((0, 0, 2.55, 0.62), (0.45, 0.1, 2.35, 0.45), (-0.45, 0.05, 2.38, 0.47), (0.15, 0.35, 2.75, 0.42), (-0.2, -0.3, 2.7, 0.4), (0, 0.1, 3.0, 0.35))):
        p.append(ellipsoid(f'leaf{i}', (x, y, z), (r, r, r * 0.8), Lf if i % 2 else Lf2, FLAT, 'crown', seg=8, rings=6, smooth=False))
    for i, (x, y, z) in enumerate(((0.35, -0.45, 2.6), (-0.4, -0.35, 2.45), (0.05, -0.5, 2.85), (0.55, 0.2, 2.65))):
        p.append(ellipsoid(f'blossom{i}', (x, y, z), (0.09, 0.09, 0.07), Bl, glow(0.2), 'crown', seg=6, rings=4))
    for s in (-1, 1):
        side = 'l' if s > 0 else 'r'
        p += [ellipsoid(f'eye{s}', (s * 0.16, -0.42, 1.9), (0.08, 0.04, 0.06), E, glow(1), 'upper', seg=8, rings=5),
              box(f'brow{s}', (s * 0.16, -0.44, 2.0), (0.2, 0.06, 0.06), Wd, FLAT, 'upper', rot=(0, s * 15, 0)),
              tube(f'armA{s}', [(s * 0.45, 0, 1.9), (s * 0.85, -0.05, 1.7), (s * 1.0, -0.15, 1.2), (s * 1.0, -0.25, 0.85)], [0.17, 0.14, 0.11, 0.08], W, FLAT, f'arm_{side}'),
              tube(f'twig{s}', [(s * 0.85, -0.05, 1.7), (s * 1.15, 0.05, 2.0), (s * 1.25, 0.05, 2.25)], [0.07, 0.05, 0.03], W, FLAT, f'arm_{side}'),
              ellipsoid(f'twigleaf{s}', (s * 1.27, 0.05, 2.33), (0.18, 0.15, 0.14), Lf2, FLAT, f'arm_{side}', seg=6, rings=4, smooth=False),
              cylinder(f'leg{s}', (s * 0.32, 0, 0.6), (s * 0.36, -0.05, 0.05), 0.2, Wd, FLAT, f'leg_{side}', seg=7)]
        for k in range(3):
            a = math.radians(-60 + k * 60)
            p.append(tube(f'root{s}{k}', [(s * 0.36, -0.05, 0.1), (s * 0.36 + math.sin(a) * 0.3, -0.05 - math.cos(a) * 0.3, 0.04), (s * 0.36 + math.sin(a) * 0.5, -0.05 - math.cos(a) * 0.5, 0.0)], [0.08, 0.05, 0.03], Wd, FLAT, f'leg_{side}'))
        for k in range(4):
            z = 1.2 + 0.18 * k
            p.append(cone(f'thorn{s}{k}', (s * 0.98, -0.18, z), (s * 0.6, -0.6, 0.3), 0.04, 0.2, T, FLAT, f'arm_{side}', seg=4))
    for k in range(8):
        a = 2 * math.pi * k / 8
        p.append(cone(f'bodythorn{k}', (math.cos(a) * 0.48, math.sin(a) * 0.48, 0.9 + 0.12 * (k % 3)), (math.cos(a), math.sin(a), 0.3), 0.05, 0.22, T, FLAT, 'trunk', seg=4))
    body = finish('thorn_treant', arm, p)
    anim(arm, 'Idle', 48, {'upper': rot_keys(48, (0, 0, 3), (0, 0, -3)), 'crown': rot_keys(48, (0, 0, -4), (0, 0, 4)), 'arm_l': rot_keys(48, (0, 0, 0), (-6, 0, 4)), 'arm_r': rot_keys(48, (0, 0, 0), (-6, 0, -4))}, True)
    anim(arm, 'Walk', 36, {'leg_l': rot_keys(36, (22, 0, 0), (-22, 0, 0)), 'leg_r': rot_keys(36, (-22, 0, 0), (22, 0, 0)), 'trunk': rot_keys(36, (0, 0, 5), (0, 0, -5)),
                           'arm_l': rot_keys(36, (-15, 0, 0), (15, 0, 0)), 'arm_r': rot_keys(36, (15, 0, 0), (-15, 0, 0)), 'crown': rot_keys(36, (0, 0, -6), (0, 0, 6)),
                           'root': [(f, {'l': (0, 0, v)}) for f, v in cyc(36, 0, 0.06, 4)]}, True)
    anim(arm, 'Attack', 36, {'arm_l': [(0, {'r': (0, 0, 0)}), (16, {'r': (-160, 0, -20)}), (22, {'r': (30, 0, -10)}), (36, {'r': (0, 0, 0)})],
                             'arm_r': [(0, {'r': (0, 0, 0)}), (16, {'r': (-160, 0, 20)}), (22, {'r': (30, 0, 10)}), (36, {'r': (0, 0, 0)})],
                             'upper': [(0, {'r': (0, 0, 0)}), (16, {'r': (-18, 0, 0)}), (22, {'r': (25, 0, 0)}), (36, {'r': (0, 0, 0)})]})
    anim(arm, 'Hit', 14, {'upper': [(0, {'r': (0, 0, 0)}), (4, {'r': (-12, 0, 6)}), (14, {'r': (0, 0, 0)})], 'crown': [(0, {'r': (0, 0, 0)}), (4, {'r': (-10, 0, -8)}), (14, {'r': (0, 0, 0)})]})
    anim(arm, 'Death', 40, {'trunk': [(0, {'r': (0, 0, 0)}), (30, {'r': (-88, 0, 0)}), (40, {'r': (-85, 0, 0)})], 'root': [(0, {'l': (0, 0, 0)}), (30, {'l': (0, 0.2, 0.2)}), (40, {'l': (0, 0.2, 0.15)})],
                            'arm_l': [(0, {'r': (0, 0, 0)}), (30, {'r': (0, 0, 40)})], 'arm_r': [(0, {'r': (0, 0, 0)}), (30, {'r': (0, 0, -40)})]})
    anim(arm, 'Spawn', 34, {'root': [(0, {'l': (0, 0, -2.6)}), (26, {'l': (0, 0, 0.1)}), (34, {'l': (0, 0, 0)})], 'arm_l': [(0, {'r': (-150, 0, 0)}), (34, {'r': (0, 0, 0)})], 'arm_r': [(0, {'r': (-150, 0, 0)}), (34, {'r': (0, 0, 0)})]})
    return arm, body

# ---------------------------------------------------------------- lava golem boss
def lava_golem():
    arm = make_rig('boss_lava_golem', [('root', None, (0, 0, 0)), ('hips', 'root', (0, 0, 1.2)), ('chest', 'hips', (0, 0, 1.9)), ('head', 'chest', (0, -0.35, 2.85)),
                                        ('arm_l', 'chest', (1.0, 0, 2.55)), ('fore_l', 'arm_l', (1.25, -0.1, 1.75)), ('arm_r', 'chest', (-1.0, 0, 2.55)), ('fore_r', 'arm_r', (-1.25, -0.1, 1.75)),
                                        ('leg_l', 'hips', (0.45, 0, 1.1)), ('leg_r', 'hips', (-0.45, 0, 1.1))])
    B = (0.2, 0.17, 0.16); B2 = (0.3, 0.24, 0.2); L = (1.0, 0.45, 0.05); Y = (1.0, 0.9, 0.3)
    p = [box('pelvis', (0, 0, 1.2), (1.0, 0.7, 0.5), B, FLAT, 'hips', bevel=0.08),
         box('chestR', (0, 0, 2.3), (1.6, 1.0, 1.0), B2, FLAT, 'chest', bevel=0.12, rot=(8, 0, 0)),
         ellipsoid('core', (0, -0.48, 2.25), (0.4, 0.2, 0.4), L, glow(1), 'chest', seg=10, rings=7),
         box('chestPlateL', (0.42, -0.5, 2.55), (0.55, 0.15, 0.4), B, FLAT, 'chest', bevel=0.05, rot=(0, -12, 0)),
         box('chestPlateR', (-0.42, -0.5, 2.55), (0.55, 0.15, 0.4), B, FLAT, 'chest', bevel=0.05, rot=(0, 12, 0)),
         box('head', (0, -0.4, 3.0), (0.55, 0.5, 0.45), B2, FLAT, 'head', bevel=0.06),
         box('brow', (0, -0.66, 3.12), (0.6, 0.12, 0.12), B, FLAT, 'head'),
         box('mouthGlow', (0, -0.66, 2.88), (0.32, 0.04, 0.06), L, glow(1), 'head')]
    for i, (x, z, rz) in enumerate(((0.55, 2.0, 35), (-0.6, 2.2, -30), (0.25, 1.85, -60), (-0.2, 2.65, 20), (0.7, 2.6, -15))):
        p.append(box(f'crack{i}', (x, -0.52, z), (0.35, 0.03, 0.05), L, glow(0.95), 'chest', rot=(0, rz, 0)))
    for s in (-1, 1):
        side = 'l' if s > 0 else 'r'
        p += [ellipsoid(f'eye{s}', (s * 0.14, -0.66, 3.02), (0.08, 0.03, 0.05), Y, glow(1), 'head', seg=8, rings=5),
              ellipsoid(f'shoulder{s}', (s * 1.05, 0, 2.7), (0.48, 0.45, 0.42), B, FLAT, f'arm_{side}', seg=8, rings=6, smooth=False),
              cone(f'shoulderSpike{s}', (s * 1.15, 0.05, 3.0), (s * 0.3, 0.1, 1), 0.14, 0.45, B2, FLAT, f'arm_{side}', seg=5),
              ellipsoid(f'shoulderLava{s}', (s * 1.0, -0.25, 2.55), (0.18, 0.12, 0.1), L, glow(0.9), f'arm_{side}', seg=6, rings=4),
              box(f'upperArm{s}', (s * 1.15, -0.05, 2.15), (0.42, 0.42, 0.75), B2, FLAT, f'arm_{side}', bevel=0.06),
              box(f'foreArm{s}', (s * 1.28, -0.1, 1.45), (0.5, 0.5, 0.75), B, FLAT, f'fore_{side}', bevel=0.07),
              box(f'fist{s}', (s * 1.32, -0.15, 0.85), (0.7, 0.7, 0.6), B2, FLAT, f'fore_{side}', bevel=0.1),
              box(f'knuckle{s}', (s * 1.32, -0.52, 0.85), (0.55, 0.06, 0.12), L, glow(0.9), f'fore_{side}'),
              box(f'thigh{s}', (s * 0.48, 0, 0.8), (0.5, 0.55, 0.6), B2, FLAT, f'leg_{side}', bevel=0.06),
              box(f'shin{s}', (s * 0.5, -0.05, 0.3), (0.6, 0.75, 0.6), B, FLAT, f'leg_{side}', bevel=0.08),
              box(f'kneeLava{s}', (s * 0.5, -0.43, 0.55), (0.25, 0.04, 0.06), L, glow(0.9), f'leg_{side}')]
    body = finish('boss_lava_golem', arm, p)
    anim(arm, 'Idle', 48, {'chest': rot_keys(48, (0, 0, 0), (5, 0, 0)), 'hips': [(f, {'l': (0, 0, v)}) for f, v in cyc(48, 0, -0.06)],
                           'arm_l': rot_keys(48, (0, 0, 0), (0, 0, 5)), 'arm_r': rot_keys(48, (0, 0, 0), (0, 0, -5))}, True)
    anim(arm, 'Walk', 40, {'leg_l': rot_keys(40, (22, 0, 0), (-22, 0, 0)), 'leg_r': rot_keys(40, (-22, 0, 0), (22, 0, 0)), 'arm_l': rot_keys(40, (-18, 0, 0), (18, 0, 0)), 'arm_r': rot_keys(40, (18, 0, 0), (-18, 0, 0)),
                           'hips': [(f, {'l': (0, 0, v)}) for f, v in cyc(40, 0, 0.12, 4)], 'chest': rot_keys(40, (8, 6, 0), (8, -6, 0))}, True)
    anim(arm, 'Attack', 44, {'arm_l': [(0, {'r': (0, 0, 0)}), (20, {'r': (-165, 0, -15)}), (27, {'r': (35, 0, -10)}), (44, {'r': (0, 0, 0)})],
                             'arm_r': [(0, {'r': (0, 0, 0)}), (20, {'r': (-165, 0, 15)}), (27, {'r': (35, 0, 10)}), (44, {'r': (0, 0, 0)})],
                             'chest': [(0, {'r': (0, 0, 0)}), (20, {'r': (-22, 0, 0)}), (27, {'r': (30, 0, 0)}), (44, {'r': (0, 0, 0)})],
                             'hips': [(0, {'l': (0, 0, 0)}), (20, {'l': (0, 0, 0.15)}), (27, {'l': (0, -0.3, -0.25)}), (44, {'l': (0, 0, 0)})]})
    anim(arm, 'Attack2', 40, {'chest': [(0, {'r': (0, 0, 0)}), (16, {'r': (0, 70, 0)}), (24, {'r': (0, -80, 0)}), (40, {'r': (0, 0, 0)})],
                              'arm_l': [(0, {'r': (0, 0, 0)}), (16, {'r': (-60, 0, 50)}), (24, {'r': (-70, 0, 70)}), (40, {'r': (0, 0, 0)})],
                              'arm_r': [(0, {'r': (0, 0, 0)}), (16, {'r': (-70, 0, -70)}), (24, {'r': (-60, 0, -50)}), (40, {'r': (0, 0, 0)})]})
    anim(arm, 'Cast', 48, {'arm_l': [(0, {'r': (0, 0, 0)}), (16, {'r': (-20, 0, 80)}), (36, {'r': (-20, 0, 85)}), (48, {'r': (0, 0, 0)})],
                           'arm_r': [(0, {'r': (0, 0, 0)}), (16, {'r': (-20, 0, -80)}), (36, {'r': (-20, 0, -85)}), (48, {'r': (0, 0, 0)})],
                           'chest': [(0, {'r': (0, 0, 0)}), (16, {'r': (-20, 0, 0)}), (36, {'r': (-22, 0, 0)}), (48, {'r': (0, 0, 0)})], 'head': [(0, {'r': (0, 0, 0)}), (16, {'r': (-30, 0, 0)}), (48, {'r': (0, 0, 0)})]})
    anim(arm, 'Hit', 16, {'chest': [(0, {'r': (0, 0, 0)}), (4, {'r': (-12, 0, 6)}), (16, {'r': (0, 0, 0)})]})
    anim(arm, 'Death', 60, {'hips': [(0, {'l': (0, 0, 0), 'r': (0, 0, 0)}), (30, {'l': (0, 0, -0.6), 'r': (20, 0, 0)}), (60, {'l': (0, -0.4, -1.0), 'r': (60, 0, 0)})],
                            'arm_l': [(0, {'r': (0, 0, 0)}), (40, {'r': (40, 0, 40)})], 'arm_r': [(0, {'r': (0, 0, 0)}), (40, {'r': (40, 0, -40)})], 'head': [(0, {'r': (0, 0, 0)}), (50, {'r': (50, 0, 0)})]})
    anim(arm, 'Spawn', 50, {'root': [(0, {'l': (0, 0, -3.2)}), (36, {'l': (0, 0, 0.15)}), (50, {'l': (0, 0, 0)})],
                            'arm_l': [(0, {'r': (-170, 0, 0)}), (36, {'r': (-120, 0, 20)}), (50, {'r': (0, 0, 0)})], 'arm_r': [(0, {'r': (-170, 0, 0)}), (36, {'r': (-120, 0, -20)}), (50, {'r': (0, 0, 0)})]})
    return arm, body

MONSTERS = {'slime': slime, 'vampire_bat': vampire_bat,
            'acid_slime': lambda: slime('acid_slime', (0.74, 0.93, 0.18), (0.3, 0.4, 0.04), acid=True),
            'shadow_bat': lambda: vampire_bat('shadow_bat', (0.07, 0.05, 0.11), (0.17, 0.08, 0.27), (0.24, 0.17, 0.33), (0.78, 0.38, 1.0), shadow=True), 'gargoyle': gargoyle, 'lava_imp': lava_imp, 'thorn_treant': thorn_treant, 'boss_lava_golem': lava_golem}

def export_monster(mid, fn):
    reset()
    arm, body = fn()
    for pb in arm.pose.bones: pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    kind = 'bosses' if mid.startswith('boss_') else 'monsters'
    path = export_glb(OUT / kind / f'{mid}.glb', [arm, body], animations=True)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    return path, {'triangles': tris, 'clips': sorted(a.name for a in bpy.data.actions)}
