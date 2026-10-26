# Second wave of original procedural monsters (v1.1): spiders, wraiths, lizards, myconids and dire wolves.
# Same conventions as monsters.py: rigid-skinned parts, bones pointing +Z, 'r' keys are local Euler degrees
# (x = pitch, positive tips forward; y = yaw; z = roll, positive lifts +X parts), 'l'/'s' keys are world axes.
import math
from mathutils import Vector, Euler
from kk import ellipsoid, box, cone, cylinder, tube, torus, plate, FLAT
from accessories import glow
from monsters import make_rig, finish, anim, cyc, rot_keys

def surf(c, radii, u, rot=(0, 0, 0), push=0.0):
    """Point on an ellipsoid surface along local direction u (optionally pushed outwards)."""
    u = Vector(u).normalized()
    v = Vector((u.x * radii[0], u.y * radii[1], u.z * radii[2]))
    v = v * (1 + push / max(v.length, 1e-6))
    return Vector(c) + Euler([math.radians(a) for a in rot]).to_matrix() @ v

def bob(n, a, b, cycles=2, axis=2):
    return [(f, {'l': tuple(v if i == axis else 0 for i in range(3))}) for f, v in cyc(n, a, b, cycles)]

def sprawl_gait(n, phase, yaw, lift, s):
    """Leg that swings around the vertical axis (spiders, lizards): planted front -> back, then lifted swing."""
    front, back, up = (0, -s * yaw, 0), (0, s * yaw, 0), (0, 0, s * lift)
    seq = [(0.0, front), (0.5, back), (0.75, up), (1.0, front)] if phase == 0 else [(0.0, back), (0.25, up), (0.5, front), (1.0, back)]
    return [(round(t * n), {'r': v}) for t, v in seq]

def pitch_gait(n, phase, amp):
    """Leg that swings fore/aft (wolves, myconids). Negative pitch = forward for a hanging leg."""
    a, b = (-amp, 0, 0), (amp, 0, 0)
    return rot_keys(n, a, b) if phase == 0 else rot_keys(n, b, a)

ZERO = {'r': (0, 0, 0)}

# ---------------------------------------------------------------- spider (织网蛛 / 剧毒蛛)
def spider(name, C):
    Z = 0.62
    bones = [('root', None, (0, 0, 0)), ('body', 'root', (0, 0, Z)), ('head', 'body', (0, -0.4, Z + 0.02)), ('abdomen', 'body', (0, 0.2, Z + 0.06))]
    for s in (1, -1):
        for i in range(4):
            bones.append((f'leg_{"l" if s > 0 else "r"}{i}', 'body', (s * 0.22, -0.32 + i * 0.15, Z)))
    arm = make_rig(name, bones)
    th_c, th_r = (0, -0.12, Z), (0.34, 0.4, 0.24)
    hd_c, hd_r = (0, -0.5, Z + 0.04), (0.22, 0.2, 0.18)
    ab_c, ab_r, ab_rot = (0, 0.66, Z + 0.24), (0.5, 0.62, 0.45), (14, 0, 0)
    p = [ellipsoid('thorax', th_c, th_r, C['body'], FLAT, 'body', seg=12, rings=8),
         ellipsoid('carapace', (0, -0.14, Z + 0.1), (0.26, 0.3, 0.16), C['dark'], FLAT, 'body', seg=10, rings=6, smooth=False),
         ellipsoid('head', hd_c, hd_r, C['body'], FLAT, 'head', seg=10, rings=7),
         ellipsoid('abdomen', ab_c, ab_r, C['body'], C.get('abGlow', FLAT), 'abdomen', seg=14, rings=10, rot=ab_rot)]
    # abdomen pattern: a skull/hourglass mark plus side chevrons
    for k, (u, r) in enumerate((((0, -0.35, 1), (0.17, 0.2, 0.06)), ((0, 0.2, 1), (0.12, 0.15, 0.05)), ((0, 0.65, 0.75), (0.09, 0.1, 0.05)))):
        p.append(ellipsoid(f'mark{k}', surf(ab_c, ab_r, u, ab_rot), r, C['mark'], C.get('markGlow', FLAT), 'abdomen', seg=8, rings=5, rot=ab_rot))
    for s in (-1, 1):
        for k in range(3):
            p.append(ellipsoid(f'chev{s}{k}', surf(ab_c, ab_r, (s * 0.8, -0.3 + k * 0.4, 0.55), ab_rot), (0.06, 0.13, 0.05), C['mark'], C.get('markGlow', FLAT), 'abdomen', seg=6, rings=4, rot=(ab_rot[0], 0, -s * 40)))
    for k in range(3):  # spinnerets
        p.append(cone(f'spin{k}', surf(ab_c, ab_r, ((k - 1) * 0.25, 1, -0.2), ab_rot), (0, 1, -0.2), 0.05, 0.12, C['dark'], FLAT, 'abdomen', seg=5))
    if C.get('hair'):
        for k in range(8):
            u = (math.sin(k * 2.1) * 0.6, -0.6 + k * 0.17, 1)
            p.append(cone(f'hair{k}', surf(ab_c, ab_r, u, ab_rot, -0.02), (u[0], 0.3, 1), 0.035, 0.16, C['dark'], FLAT, 'abdomen', seg=4))
    if C.get('sac'):  # venom sacs glowing under the abdomen
        for s in (-1, 1):
            p.append(ellipsoid(f'sac{s}', surf(ab_c, ab_r, (s * 0.55, -0.1, -0.6), ab_rot), (0.15, 0.2, 0.13), C['sac'], glow(0.9), 'abdomen', seg=8, rings=6))
    # eyes: two large, two medium, four small
    for s in (-1, 1):
        for u, r in (((s * 0.28, -1, 0.3), 0.065), ((s * 0.55, -0.8, 0.55), 0.045), ((s * 0.2, -0.75, 0.75), 0.035), ((s * 0.65, -0.45, 0.6), 0.03)):
            p.append(ellipsoid(f'eye{s}{r}', surf(hd_c, hd_r, u), (r, r * 0.8, r), C['eye'], glow(1), 'head', seg=8, rings=5))
        base = surf(hd_c, hd_r, (s * 0.35, -1, -0.45))
        p += [ellipsoid(f'chel{s}', base, (0.07, 0.08, 0.1), C['dark'], FLAT, 'head', seg=6, rings=5),
              cone(f'fang{s}', base + Vector((0, -0.02, -0.06)), (-s * 0.25, -0.35, -1), 0.045, 0.2, C['fang'], C.get('fangGlow', FLAT), 'head', seg=5)]
    # legs
    angles = (-58, -22, 14, 48); reach = (1.2, 1.05, 1.05, 1.2)
    for s in (-1, 1):
        side = 'l' if s > 0 else 'r'
        for i in range(4):
            a = math.radians(angles[i]); d = Vector((s * math.cos(a), math.sin(a), 0))
            B = Vector((s * 0.24, -0.32 + i * 0.15, Z))
            K = B + d * (0.48 * reach[i]) + Vector((0, 0, 0.4))
            F = B + d * (1.08 * reach[i]) + Vector((0, 0, -Z + 0.02))
            bone = f'leg_{side}{i}'
            p += [tube(f'femur{s}{i}', [B, B + d * 0.22 * reach[i] + Vector((0, 0, 0.28)), K], [0.075, 0.065, 0.052], C['leg'], FLAT, bone, seg=6),
                  ellipsoid(f'knee{s}{i}', K, (0.07, 0.07, 0.07), C['band'], FLAT, bone, seg=6, rings=4),
                  tube(f'tibia{s}{i}', [K, K + d * 0.32 * reach[i] + Vector((0, 0, -0.12)), F], [0.052, 0.04, 0.014], C['leg'], FLAT, bone, seg=6)]
    body = finish(name, arm, p)
    legs = [(f'leg_{"l" if s > 0 else "r"}{i}', s, i) for s in (1, -1) for i in range(4)]
    grp = lambda s, i: (i + (0 if s > 0 else 1)) % 2
    k = {'body': bob(40, 0, 0.025), 'abdomen': [(0, {'s': 1}), (20, {'s': 1.05}), (40, {'s': 1})], 'head': rot_keys(40, (0, 0, 0), (-5, 0, 0))}
    for b, s, i in legs: k[b] = rot_keys(40, (0, -s * 2, 0), (0, s * 2, s * 3)) if grp(s, i) else rot_keys(40, (0, s * 2, s * 3), (0, -s * 2, 0))
    anim(arm, 'Idle', 40, k, True)
    k = {'body': bob(16, 0, 0.035, 4), 'abdomen': rot_keys(16, (0, 4, 0), (0, -4, 0))}
    for b, s, i in legs: k[b] = sprawl_gait(16, grp(s, i), 16, 22, s)
    anim(arm, 'Walk', 16, k, True)
    # bite: rear up with front legs raised, then lunge
    k = {'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (8, {'r': (-22, 0, 0), 'l': (0, 0.12, 0.12)}), (12, {'r': (16, 0, 0), 'l': (0, -0.45, 0)}), (24, {'r': (0, 0, 0), 'l': (0, 0, 0)})],
         'head': [(0, ZERO), (8, {'r': (-15, 0, 0)}), (12, {'r': (25, 0, 0)}), (24, ZERO)]}
    for b, s, i in legs:
        if i == 0: k[b] = [(0, ZERO), (8, {'r': (0, -s * 12, s * 55)}), (12, {'r': (0, -s * 20, s * 8)}), (24, ZERO)]
    anim(arm, 'Attack', 24, k)
    # web shot / venom spray: the abdomen swings up and over, then snaps
    k = {'abdomen': [(0, ZERO), (10, {'r': (55, 0, 0)}), (14, {'r': (68, 0, 0), 's': 1.08}), (18, {'r': (50, 0, 0), 's': 1}), (28, ZERO)],
         'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (10, {'r': (10, 0, 0), 'l': (0, 0, -0.06)}), (14, {'r': (4, 0, 0), 'l': (0, 0.12, -0.04)}), (28, {'r': (0, 0, 0), 'l': (0, 0, 0)})],
         'head': [(0, ZERO), (10, {'r': (-12, 0, 0)}), (28, ZERO)]}
    anim(arm, 'Cast', 28, k)
    anim(arm, 'Hit', 10, {'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (3, {'r': (-14, 0, 8), 'l': (0, 0.18, 0.04)}), (10, {'r': (0, 0, 0), 'l': (0, 0, 0)})],
                          'abdomen': [(0, {'s': 1}), (3, {'s': (1.1, 1.1, 0.88)}), (10, {'s': 1})]})
    k = {'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (10, {'r': (0, 0, 80), 'l': (0, 0, 0.35)}), (20, {'r': (0, 0, 172), 'l': (0, 0, 0.0)}), (30, {'r': (0, 0, 178), 'l': (0, 0, -0.1)})]}
    for b, s, i in legs: k[b] = [(0, ZERO), (12, {'r': (0, 0, -s * 20)}), (24, {'r': (0, -s * 10, -s * 62)}), (30, {'r': (0, -s * 12, -s * 66)})]
    anim(arm, 'Death', 30, k)
    # drops in on a thread
    k = {'root': [(0, {'l': (0, 0, 3.2)}), (12, {'l': (0, 0, 0.0)}), (15, {'l': (0, 0, 0.12)}), (20, {'l': (0, 0, 0)})]}
    for b, s, i in legs: k[b] = [(0, {'r': (0, 0, s * 45)}), (12, {'r': (0, 0, s * 30)}), (20, ZERO)]
    anim(arm, 'Spawn', 20, k)
    return arm, body

# ---------------------------------------------------------------- wraith (噬魂怨灵 / 哀嚎女妖)
def wraith(name, C, banshee=False):
    arm = make_rig(name, [('root', None, (0, 0, 0)), ('body', 'root', (0, 0, 0.9)), ('skirt', 'body', (0, 0, 0.92)), ('head', 'body', (0, -0.04, 1.72)),
                          ('arm_l', 'body', (0.42, -0.05, 1.58)), ('arm_r', 'body', (-0.42, -0.05, 1.58))])
    R, R2, T = C['robe'], C['robe2'], C.get('robeGlow', FLAT)
    p = [cone('torso', (0, 0, 0.88), (0, 0, 1), 0.44, 0.9, R, T, 'body', seg=12, tip_radius=0.24),
         ellipsoid('mantle', (0, 0.02, 1.6), (0.5, 0.42, 0.17), R2, T, 'body', seg=12, rings=6),
         cone('skirtTop', (0, 0, 0.95), (0, 0, -1), 0.44, 0.52, R, T, 'skirt', seg=12, tip_radius=0.64),
         ellipsoid('hood', (0, 0.0, 1.86), (0.3, 0.33, 0.34), R2, T, 'head', seg=12, rings=8),
         cone('hoodPeak', (0, 0.12, 2.08), (0, 0.8, 0.6), 0.14, 0.3, R2, T, 'head', seg=6),
         ellipsoid('face', (0, -0.2, 1.82), (0.2, 0.16, 0.23), (0.02, 0.02, 0.03), FLAT, 'head', seg=10, rings=7)]
    for s in (-1, 1):
        p.append(ellipsoid(f'eye{s}', (s * 0.085, -0.34, 1.86), (0.05, 0.03, 0.035 if not banshee else 0.05), C['eye'], glow(1), 'head', seg=8, rings=5))
    # tattered hem: pointed strips hanging around the skirt
    for i in range(11):
        a = 2 * math.pi * i / 11 + 0.15
        rad = Vector((math.cos(a), math.sin(a), 0)); t = Vector((-math.sin(a), math.cos(a), 0)); c = rad * 0.62 + Vector((0, 0, 0.45))
        drop = 0.32 + 0.14 * ((i * 7) % 3)
        pts = [c - t * 0.15, c + t * 0.15, c + t * 0.06 + rad * 0.06 + Vector((0, 0, -drop * 0.7)), c + rad * 0.1 + Vector((0, 0, -drop)), c - t * 0.08 + rad * 0.05 + Vector((0, 0, -drop * 0.6))]
        p.append(plate(f'rag{i}', pts, rad, 0.025, R if i % 2 else R2, T, 'skirt'))
        if C.get('hemGlow'):
            p.append(cylinder(f'hem{i}', c - t * 0.15 + rad * 0.013, c + t * 0.15 + rad * 0.013, 0.012, C['hemGlow'], glow(0.7), 'skirt', seg=4))
    for s in (-1, 1):
        side = 'l' if s > 0 else 'r'
        sh = Vector((s * 0.42, -0.05, 1.6)); d = Vector((s * 0.28, -0.45, -0.85)).normalized()
        wrist = sh + d * 0.62
        p += [cone(f'sleeve{s}', sh, d, 0.13, 0.62, R2, T, f'arm_{side}', seg=8, tip_radius=0.19),
              ellipsoid(f'palm{s}', wrist + d * 0.06, (0.07, 0.08, 0.06), C['hand'], FLAT, f'arm_{side}', seg=6, rings=4)]
        for f in range(3):
            fd = (d + Vector(((f - 1) * 0.35, -0.2, 0))).normalized()
            p.append(cone(f'finger{s}{f}', wrist + d * 0.09 + Vector(((f - 1) * 0.04, 0, 0)), fd, 0.022, 0.26, C['hand'], C.get('clawGlow', FLAT), f'arm_{side}', seg=4))
    if banshee:
        p.append(ellipsoid('mouth', (0, -0.33, 1.71), (0.055, 0.03, 0.09), C['eye'], glow(1), 'head', seg=8, rings=5))
        for i in range(9):  # long flowing hair spilling out of the hood
            a = math.radians(-70 + i * 17.5)
            top = Vector((math.sin(a) * 0.24, 0.05 + math.cos(a) * 0.12, 1.98))
            pts = [top, top + Vector((math.sin(a) * 0.12, 0.2, -0.35)), top + Vector((math.sin(a) * 0.18, 0.32, -0.75)), top + Vector((math.sin(a) * 0.2, 0.38, -1.05 - 0.08 * (i % 3)))]
            p.append(tube(f'hair{i}', pts, [0.05, 0.045, 0.03, 0.01], C['hair'], glow(0.25), 'head', seg=5))
        p.append(torus('choker', (0, -0.02, 1.62), 0.2, 0.025, C['eye'], glow(0.8), 'body', seg=14, tseg=4))
    else:
        p.append(ellipsoid('soul', (0, -0.38, 1.3), (0.13, 0.09, 0.15), C['eye'], glow(1), 'body', seg=10, rings=7))
        p.append(torus('soulCage', (0, -0.36, 1.3), 0.16, 0.018, C['hand'], FLAT, 'body', seg=12, tseg=4, rot=(90, 0, 0)))
        for k in range(5):  # shackle chain hanging from the waist
            a = math.radians(-30 - k * 12)
            c = Vector((0.36 + k * 0.06, -0.12 - k * 0.03, 1.02 - k * 0.11))
            p.append(torus(f'link{k}', c, 0.045, 0.014, (0.42, 0.45, 0.48), FLAT, 'skirt', seg=8, tseg=4, rot=(0, 90 if k % 2 else 0, 20)))
    body = finish(name, arm, p)
    anim(arm, 'Idle', 48, {'body': bob(48, 0, 0.09), 'skirt': rot_keys(48, (6, 0, 5), (2, 0, -5)), 'arm_l': rot_keys(48, (0, 0, 0), (-8, 0, 4)),
                           'arm_r': rot_keys(48, (-8, 0, -4), (0, 0, 0)), 'head': rot_keys(48, (0, 7, 0), (0, -7, 0))}, True)
    anim(arm, 'Walk', 32, {'body': [(f, {'l': (0, 0, v), 'r': (12, 0, 0)}) for f, v in cyc(32, 0, 0.08)], 'skirt': rot_keys(32, (20, 0, 5), (14, 0, -5)),
                           'arm_l': rot_keys(32, (22, 0, 4), (16, 0, 0)), 'arm_r': rot_keys(32, (16, 0, 0), (22, 0, -4)), 'head': rot_keys(32, (-10, 0, 0), (-8, 0, 0))}, True)
    anim(arm, 'Attack', 26, {'arm_r': [(0, ZERO), (9, {'r': (-120, 0, -30)}), (13, {'r': (40, 0, 10)}), (26, ZERO)],
                             'arm_l': [(0, ZERO), (11, {'r': (-110, 0, 30)}), (15, {'r': (45, 0, -10)}), (26, ZERO)],
                             'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (9, {'r': (-15, 0, 0), 'l': (0, 0.15, 0.1)}), (14, {'r': (20, 0, 0), 'l': (0, -0.55, 0)}), (26, {'r': (0, 0, 0), 'l': (0, 0, 0)})],
                             'skirt': [(0, ZERO), (14, {'r': (25, 0, 0)}), (26, ZERO)]})
    if banshee:  # scream: rear back, arms flung wide, head thrown forward
        cast = {'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (10, {'r': (-18, 0, 0), 'l': (0, 0.1, 0.25)}), (14, {'r': (8, 0, 0), 'l': (0, 0, 0.3)}), (30, {'r': (6, 0, 0), 'l': (0, 0, 0.25)}), (36, {'r': (0, 0, 0), 'l': (0, 0, 0)})],
                'arm_l': [(0, ZERO), (10, {'r': (-30, 0, 40)}), (14, {'r': (-50, 0, 85)}), (30, {'r': (-50, 0, 80)}), (36, ZERO)],
                'arm_r': [(0, ZERO), (10, {'r': (-30, 0, -40)}), (14, {'r': (-50, 0, -85)}), (30, {'r': (-50, 0, -80)}), (36, ZERO)],
                'head': [(0, ZERO), (10, {'r': (-25, 0, 0)}), (14, {'r': (15, 0, 0), 's': 1.1}), (30, {'r': (12, 0, 0), 's': 1.08}), (36, {'r': (0, 0, 0), 's': 1})]}
    else:  # soul tether: both claws reach forward, hold
        cast = {'body': [(0, {'r': (0, 0, 0)}), (10, {'r': (-10, 0, 0)}), (32, {'r': (-12, 0, 0)}), (36, {'r': (0, 0, 0)})],
                'arm_l': [(0, ZERO), (10, {'r': (-85, 0, 18)}), (32, {'r': (-90, 0, 22)}), (36, ZERO)],
                'arm_r': [(0, ZERO), (10, {'r': (-85, 0, -18)}), (32, {'r': (-90, 0, -22)}), (36, ZERO)],
                'head': [(0, ZERO), (10, {'r': (10, 0, 0)}), (36, ZERO)]}
    anim(arm, 'Cast', 36, cast)
    anim(arm, 'Hit', 10, {'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (3, {'r': (-18, 0, 6), 'l': (0, 0.2, 0)}), (10, {'r': (0, 0, 0), 'l': (0, 0, 0)})]})
    anim(arm, 'Death', 30, {'root': [(0, {'s': 1, 'r': (0, 0, 0), 'l': (0, 0, 0)}), (8, {'s': 1.15, 'r': (0, 120, 0), 'l': (0, 0, 0.2)}), (30, {'s': 0.05, 'r': (0, 560, 0), 'l': (0, 0, 1.2)})],
                            'arm_l': [(0, ZERO), (12, {'r': (-40, 0, 80)})], 'arm_r': [(0, ZERO), (12, {'r': (-40, 0, -80)})]})
    anim(arm, 'Spawn', 24, {'root': [(0, {'s': 0.05, 'r': (0, -360, 0), 'l': (0, 0, -0.6)}), (16, {'s': 1.12, 'r': (0, -30, 0), 'l': (0, 0, 0.1)}), (24, {'s': 1, 'r': (0, 0, 0), 'l': (0, 0, 0)})]})
    return arm, body

# ---------------------------------------------------------------- lizard (石化蜥 / 霜鳞蜥)
def lizard(name, C, frost=False):
    arm = make_rig(name, [('root', None, (0, 0, 0)), ('body', 'root', (0, 0.05, 0.5)), ('chest', 'body', (0, -0.38, 0.55)), ('head', 'chest', (0, -0.78, 0.64)),
                          ('jaw', 'head', (0, -0.86, 0.58)), ('tail1', 'body', (0, 0.48, 0.52)), ('tail2', 'tail1', (0, 1.02, 0.45)),
                          ('leg_fl', 'chest', (0.3, -0.45, 0.48)), ('leg_fr', 'chest', (-0.3, -0.45, 0.48)), ('leg_bl', 'body', (0.3, 0.3, 0.48)), ('leg_br', 'body', (-0.3, 0.3, 0.48))])
    S, D, Bl, E = C['scale'], C['dark'], C['belly'], C['eye']
    tr_c, tr_r = (0, 0.05, 0.55), (0.36, 0.6, 0.26)
    p = [ellipsoid('torso', tr_c, tr_r, S, FLAT, 'body', seg=12, rings=8, smooth=False),
         ellipsoid('belly', (0, 0.0, 0.4), (0.27, 0.5, 0.14), Bl, FLAT, 'body', seg=10, rings=6),
         ellipsoid('chest', (0, -0.42, 0.6), (0.33, 0.34, 0.26), S, FLAT, 'chest', seg=10, rings=7, smooth=False),
         ellipsoid('skull', (0, -0.84, 0.76), (0.21, 0.2, 0.13), S, FLAT, 'head', seg=10, rings=6, smooth=False),
         ellipsoid('snout', (0, -1.02, 0.68), (0.19, 0.3, 0.12), S, FLAT, 'head', seg=10, rings=6, smooth=False),
         ellipsoid('jaw', (0, -1.0, 0.57), (0.17, 0.27, 0.06), D, FLAT, 'jaw', seg=8, rings=5),
         ellipsoid('tongue', (0, -1.05, 0.6), (0.06, 0.18, 0.025), C['mouth'], glow(0.6) if frost else FLAT, 'jaw', seg=6, rings=4),
         tube('tailA', [(0, 0.45, 0.55), (0, 0.75, 0.52), (0, 1.05, 0.46)], [0.24, 0.19, 0.15], S, FLAT, 'tail1', seg=8),
         tube('tailB', [(0, 1.0, 0.46), (0, 1.35, 0.4), (0, 1.7, 0.34), (0, 1.98, 0.3)], [0.15, 0.11, 0.06, 0.02], S, FLAT, 'tail2', seg=8)]
    for s in (-1, 1):
        p += [ellipsoid(f'eye{s}', (s * 0.15, -0.93, 0.8), (0.065, 0.06, 0.06), E, glow(1), 'head', seg=8, rings=5),
              box(f'pupil{s}', (s * 0.19, -0.95, 0.8), (0.012, 0.03, 0.09), (0.05, 0.04, 0.02), FLAT, 'head'),
              box(f'brow{s}', (s * 0.15, -0.9, 0.87), (0.16, 0.12, 0.04), D, FLAT, 'head', rot=(0, -s * 14, 0))]
        for t in range(3):
            p.append(cone(f'tooth{s}{t}', (s * 0.1, -1.08 - t * 0.07, 0.63), (0, 0, -1), 0.018, 0.06, (0.95, 0.92, 0.85), FLAT, 'head', seg=4))
    # dorsal spines / crystals, and a crest frill behind the head
    for k in range(7):
        y = -0.55 + k * 0.2; z = 0.82 - abs(k - 2) * 0.03
        bone = 'chest' if y < -0.3 else 'body' if y < 0.45 else 'tail1'
        if frost:
            p.append(cone(f'crystal{k}', (math.sin(k * 1.7) * 0.06, y, z - 0.04), (math.sin(k * 2.3) * 0.3, 0.25, 1), 0.08, 0.34 - abs(k - 3) * 0.03, C['crest'], glow(0.4), bone, seg=4))
        else:
            p.append(cone(f'spine{k}', (0, y, z - 0.02), (0, 0.45, 1), 0.07, 0.26 - abs(k - 3) * 0.02, C['crest'], FLAT, bone, seg=4))
    if frost:
        for s in (-1, 1):
            p.append(cone(f'shoulderIce{s}', (s * 0.28, -0.4, 0.75), (s * 0.6, 0.1, 1), 0.07, 0.3, C['crest'], glow(0.4), 'chest', seg=4))
        p.append(ellipsoid('breath', (0, -1.17, 0.62), (0.07, 0.05, 0.05), C['crest'], glow(1), 'jaw', seg=6, rings=4))
    else:
        for i in range(5):  # basilisk frill
            a = math.radians(-60 + i * 30)
            root = Vector((math.sin(a) * 0.14, -0.72, 0.84))
            tip = root + Vector((math.sin(a) * 0.36, 0.22, math.cos(a) * 0.32 + 0.1))
            p.append(plate(f'frill{i}', [root - Vector((0.05, 0, 0)), root + Vector((0.05, 0, 0)), tip + Vector((0.07, 0, 0)), tip + Vector((0, 0.05, 0.06)), tip - Vector((0.07, 0, 0))], (0, 1, -0.3), 0.025, C['crest'], FLAT, 'head'))
            p.append(cylinder(f'frillRay{i}', root, tip, 0.018, D, FLAT, 'head', seg=4))
        p.append(ellipsoid('gazeGem', (0, -0.95, 0.9), (0.045, 0.04, 0.045), E, glow(1), 'head', seg=6, rings=4))
    for s in (-1, 1):
        for front, bone in ((1, f'leg_f{"l" if s > 0 else "r"}'), (0, f'leg_b{"l" if s > 0 else "r"}')):
            y = -0.45 if front else 0.3
            H = Vector((s * 0.3, y, 0.48)); Eb = Vector((s * 0.6, y - 0.04, 0.36)); F = Vector((s * 0.64, y - 0.12, 0.05))
            p += [tube(f'upper{s}{front}', [H, (H + Eb) / 2 + Vector((0, 0, 0.04)), Eb], [0.12, 0.11, 0.09], S, FLAT, bone, seg=6),
                  tube(f'lower{s}{front}', [Eb, F], [0.085, 0.06], S, FLAT, bone, seg=6),
                  ellipsoid(f'foot{s}{front}', F + Vector((0, -0.06, -0.01)), (0.1, 0.13, 0.04), D, FLAT, bone, seg=6, rings=4)]
            for c in range(3):
                p.append(cone(f'claw{s}{front}{c}', F + Vector(((c - 1) * 0.06, -0.15, 0)), ((c - 1) * 0.3, -1, -0.2), 0.022, 0.1, C['claw'], FLAT, bone, seg=4))
    body = finish(name, arm, p)
    legs = (('leg_fl', 1, 0), ('leg_br', -1, 0), ('leg_fr', -1, 1), ('leg_bl', 1, 1))
    anim(arm, 'Idle', 40, {'chest': [(0, {'s': 1}), (20, {'s': 1.04}), (40, {'s': 1})], 'head': rot_keys(40, (0, 8, 0), (-4, -8, 0)),
                           'tail2': rot_keys(40, (0, 12, 0), (0, -12, 0)), 'tail1': rot_keys(40, (0, -4, 0), (0, 4, 0)), 'jaw': [(0, ZERO), (30, ZERO), (34, {'r': (12, 0, 0)}), (40, ZERO)]}, True)
    k = {'body': [(f, {'r': (0, v, 0)}) for f, v in cyc(20, 7, -7)], 'chest': rot_keys(20, (0, -6, 0), (0, 6, 0)), 'head': rot_keys(20, (0, -4, 0), (0, 4, 0)),
         'tail1': rot_keys(20, (0, -10, 0), (0, 10, 0)), 'tail2': rot_keys(20, (0, -14, 0), (0, 14, 0)), 'root': bob(20, 0, 0.03, 4)}
    for b, s, ph in legs: k[b] = sprawl_gait(20, ph, 24, 20, s)
    anim(arm, 'Walk', 20, k, True)
    anim(arm, 'Attack', 22, {'chest': [(0, ZERO), (8, {'r': (-10, 0, 0)}), (12, {'r': (8, 0, 0)}), (22, ZERO)],
                             'head': [(0, ZERO), (8, {'r': (-25, 0, 0)}), (12, {'r': (15, 0, 0)}), (22, ZERO)],
                             'jaw': [(0, ZERO), (8, {'r': (38, 0, 0)}), (12, {'r': (0, 0, 0)}), (22, ZERO)],
                             'root': [(0, {'l': (0, 0, 0)}), (8, {'l': (0, 0.15, 0)}), (12, {'l': (0, -0.55, 0)}), (22, {'l': (0, 0, 0)})]})
    k = {'body': [(0, ZERO), (10, {'r': (-24, 0, 0)}), (24, {'r': (-22, 0, 0)}), (30, ZERO)], 'chest': [(0, ZERO), (10, {'r': (-12, 0, 0)}), (30, ZERO)],
         'head': [(0, ZERO), (10, {'r': (18, 0, 0)}), (14, {'r': (6, 0, 0), 's': 1.08}), (24, {'r': (10, 0, 0), 's': 1}), (30, ZERO)],
         'jaw': [(0, ZERO), (10, {'r': (40, 0, 0)}), (14, {'r': (30, 0, 0)}), (24, {'r': (36, 0, 0)}), (30, ZERO)]}
    for b, s, ph in legs:
        if b.startswith('leg_f'): k[b] = [(0, ZERO), (10, {'r': (-20, 0, s * 35)}), (24, {'r': (-20, 0, s * 30)}), (30, ZERO)]
    anim(arm, 'Cast', 30, k)
    anim(arm, 'Hit', 10, {'body': [(0, ZERO), (3, {'r': (0, 12, 0)}), (10, ZERO)], 'head': [(0, ZERO), (3, {'r': (-15, 0, 0)}), (10, ZERO)]})
    k = {'body': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (16, {'r': (0, 0, 95), 'l': (0, 0, 0.12)}), (30, {'r': (0, 0, 100), 'l': (0, 0, -0.08)})],
         'tail2': [(0, ZERO), (30, {'r': (0, 30, 0)})], 'head': [(0, ZERO), (30, {'r': (15, 0, 20)})], 'jaw': [(0, ZERO), (20, {'r': (30, 0, 0)})]}
    anim(arm, 'Death', 30, k)
    anim(arm, 'Spawn', 20, {'root': [(0, {'l': (0, 0, -0.7)}), (14, {'l': (0, 0, 0.08)}), (20, {'l': (0, 0, 0)})], 'body': [(0, {'r': (-35, 0, 0)}), (20, ZERO)]})
    return arm, body

# ---------------------------------------------------------------- myconid (迷幻菇人)
def myconid(name, C):
    arm = make_rig(name, [('root', None, (0, 0, 0)), ('body', 'root', (0, 0, 0.32)), ('cap', 'body', (0, 0, 1.22)), ('arm_l', 'body', (0.3, -0.02, 0.98)),
                          ('arm_r', 'body', (-0.3, -0.02, 0.98)), ('leg_l', 'root', (0.16, 0, 0.32)), ('leg_r', 'root', (-0.16, 0, 0.32))])
    St, Cp, Gl, Sp = C['stem'], C['cap'], C['gill'], C['spot']
    cap_c, cap_r = (0, 0, 1.36), (0.74, 0.74, 0.38)
    p = [ellipsoid('stem', (0, 0, 0.76), (0.32, 0.3, 0.48), St, FLAT, 'body', seg=12, rings=8),
         ellipsoid('cap', cap_c, cap_r, Cp, FLAT, 'cap', seg=18, rings=9),
         ellipsoid('gills', (0, 0, 1.2), (0.68, 0.68, 0.12), Gl, glow(0.25), 'cap', seg=18, rings=4),
         ellipsoid('mouth', (0, -0.28, 0.72), (0.09, 0.03, 0.045), (0.12, 0.05, 0.1), FLAT, 'body', seg=8, rings=4)]
    for i, (u, r) in enumerate((((0.1, -0.6, 0.8), 0.13), ((-0.55, -0.25, 0.8), 0.1), ((0.45, 0.3, 0.85), 0.12), ((-0.2, 0.55, 0.8), 0.09), ((0.0, 0.0, 1), 0.12),
                                ((0.62, -0.35, 0.5), 0.08), ((-0.62, 0.3, 0.5), 0.08), ((-0.3, -0.62, 0.55), 0.07), ((0.25, 0.65, 0.5), 0.07))):
        p.append(ellipsoid(f'spot{i}', surf(cap_c, cap_r, u), (r, r, r * 0.45), Sp, glow(0.75), 'cap', seg=8, rings=4))
    for k in range(3):  # baby mushrooms sprouting on the cap
        base = surf(cap_c, cap_r, (math.cos(k * 2.1) * 0.5, math.sin(k * 2.1) * 0.5, 0.75), push=-0.02)
        p += [cylinder(f'sprout{k}', base, base + Vector((0, 0, 0.14)), 0.025, St, FLAT, 'cap', seg=5),
              ellipsoid(f'sproutCap{k}', base + Vector((0, 0, 0.15)), (0.08, 0.08, 0.05), Sp, glow(0.5), 'cap', seg=8, rings=4)]
    for s in (-1, 1):
        side = 'l' if s > 0 else 'r'
        p += [ellipsoid(f'eye{s}', (s * 0.11, -0.27, 0.92), (0.05, 0.03, 0.06), C['eye'], glow(1), 'body', seg=8, rings=5),
              tube(f'arm{s}', [(s * 0.3, -0.02, 0.98), (s * 0.48, -0.06, 0.78), (s * 0.52, -0.12, 0.55)], [0.08, 0.07, 0.06], St, FLAT, f'arm_{side}', seg=6),
              ellipsoid(f'hand{s}', (s * 0.53, -0.14, 0.48), (0.09, 0.08, 0.09), St, FLAT, f'arm_{side}', seg=6, rings=4),
              ellipsoid(f'leg{s}', (s * 0.16, -0.02, 0.17), (0.13, 0.15, 0.17), St, FLAT, f'leg_{side}', seg=8, rings=5),
              ellipsoid(f'foot{s}', (s * 0.17, -0.08, 0.04), (0.13, 0.18, 0.05), C['foot'], FLAT, f'leg_{side}', seg=8, rings=4)]
    for k in range(3):  # spore sacs on the back
        p.append(ellipsoid(f'sac{k}', ((k - 1) * 0.16, 0.27, 0.7 + (k % 2) * 0.14), (0.09, 0.07, 0.09), Sp, glow(0.6), 'body', seg=8, rings=5))
    body = finish(name, arm, p)
    anim(arm, 'Idle', 40, {'cap': rot_keys(40, (0, 0, 5), (3, 0, -5)), 'body': [(0, {'s': 1}), (20, {'s': (1.03, 1.03, 0.97)}), (40, {'s': 1})],
                           'arm_l': rot_keys(40, (0, 0, 0), (-8, 0, 6)), 'arm_r': rot_keys(40, (-8, 0, -6), (0, 0, 0))}, True)
    anim(arm, 'Walk', 20, {'body': [(f, {'r': (6, 0, v)}) for f, v in cyc(20, 8, -8)], 'cap': rot_keys(20, (0, 0, -7), (0, 0, 7)), 'leg_l': pitch_gait(20, 0, 32), 'leg_r': pitch_gait(20, 1, 32),
                           'arm_l': rot_keys(20, (25, 0, 0), (-25, 0, 0)), 'arm_r': rot_keys(20, (-25, 0, 0), (25, 0, 0)), 'root': bob(20, 0, 0.06, 4)}, True)
    anim(arm, 'Attack', 22, {'arm_r': [(0, ZERO), (8, {'r': (-135, 0, -15)}), (12, {'r': (40, 0, 10)}), (22, ZERO)], 'arm_l': [(0, ZERO), (8, {'r': (-40, 0, 20)}), (22, ZERO)],
                             'body': [(0, ZERO), (8, {'r': (-12, 18, 0)}), (12, {'r': (18, -14, 0)}), (22, ZERO)], 'cap': [(0, ZERO), (12, {'r': (12, 0, 0)}), (22, ZERO)]})
    anim(arm, 'Cast', 30, {'body': [(0, {'s': 1}), (10, {'s': (1.14, 1.14, 0.78)}), (14, {'s': (0.9, 0.9, 1.18)}), (22, {'s': (0.96, 0.96, 1.05)}), (30, {'s': 1})],
                           'cap': [(0, {'s': 1, 'r': (0, 0, 0)}), (10, {'s': 0.92, 'r': (-14, 0, 0)}), (14, {'s': 1.15, 'r': (6, 0, 0)}), (22, {'s': 1.05}), (30, {'s': 1, 'r': (0, 0, 0)})],
                           'arm_l': [(0, ZERO), (10, {'r': (0, 0, -20)}), (14, {'r': (-60, 0, 70)}), (30, ZERO)], 'arm_r': [(0, ZERO), (10, {'r': (0, 0, 20)}), (14, {'r': (-60, 0, -70)}), (30, ZERO)]})
    anim(arm, 'Hit', 10, {'cap': [(0, ZERO), (3, {'r': (-10, 0, 14)}), (10, ZERO)], 'body': [(0, ZERO), (3, {'r': (-12, 0, 0)}), (10, ZERO)]})
    anim(arm, 'Death', 28, {'body': [(0, {'s': 1}), (8, {'s': (1.15, 1.15, 0.85)}), (28, {'s': (1.3, 1.3, 0.3)})],
                            'cap': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (16, {'r': (40, 0, 25), 'l': (0, -0.2, -0.3)}), (28, {'r': (70, 0, 35), 'l': (0, -0.4, -0.75)})]})
    anim(arm, 'Spawn', 24, {'root': [(0, {'s': 0.05}), (16, {'s': 1.15}), (24, {'s': 1})], 'cap': [(0, {'s': 0.3}), (18, {'s': 1.1}), (24, {'s': 1})]})
    return arm, body

# ---------------------------------------------------------------- dire wolf (血牙狼)
def wolf(name, C):
    arm = make_rig(name, [('root', None, (0, 0, 0)), ('body', 'root', (0, 0.12, 0.88)), ('chest', 'body', (0, -0.32, 0.95)), ('head', 'chest', (0, -0.68, 1.15)),
                          ('jaw', 'head', (0, -0.9, 1.08)), ('tail', 'body', (0, 0.62, 1.0)),
                          ('leg_fl', 'chest', (0.2, -0.42, 0.9)), ('leg_fr', 'chest', (-0.2, -0.42, 0.9)), ('leg_bl', 'body', (0.2, 0.42, 0.88)), ('leg_br', 'body', (-0.2, 0.42, 0.88))])
    Fu, Dk, Mk, Be, E = C['fur'], C['dark'], C['mark'], C['bone'], C['eye']
    p = [ellipsoid('torso', (0, 0.15, 0.92), (0.29, 0.55, 0.28), Fu, FLAT, 'body', seg=10, rings=7, smooth=False),
         ellipsoid('chest', (0, -0.38, 0.98), (0.33, 0.36, 0.35), Fu, FLAT, 'chest', seg=10, rings=7, smooth=False),
         ellipsoid('belly', (0, 0.05, 0.76), (0.2, 0.42, 0.12), Dk, FLAT, 'body', seg=8, rings=5),
         ellipsoid('skull', (0, -0.78, 1.2), (0.21, 0.23, 0.19), Fu, FLAT, 'head', seg=10, rings=6, smooth=False),
         box('snout', (0, -1.02, 1.13), (0.2, 0.34, 0.15), Fu, FLAT, 'head', bevel=0.03),
         ellipsoid('nose', (0, -1.19, 1.17), (0.05, 0.04, 0.04), (0.04, 0.03, 0.03), FLAT, 'head', seg=6, rings=4),
         box('jaw', (0, -1.0, 1.03), (0.17, 0.3, 0.06), Dk, FLAT, 'jaw', bevel=0.02),
         ellipsoid('maw', (0, -0.98, 1.07), (0.08, 0.2, 0.03), (0.6, 0.08, 0.06), glow(0.4), 'jaw', seg=6, rings=4),
         tube('tail', [(0, 0.62, 1.0), (0, 0.88, 0.97), (0, 1.1, 0.83), (0, 1.22, 0.62)], [0.08, 0.11, 0.08, 0.03], Dk, FLAT, 'tail', seg=6)]
    for s in (-1, 1):
        p += [cone(f'ear{s}', (s * 0.12, -0.72, 1.33), (s * 0.25, 0.25, 1), 0.07, 0.2, Dk, FLAT, 'head', seg=4),
              ellipsoid(f'eye{s}', (s * 0.1, -0.95, 1.25), (0.05, 0.03, 0.03), E, glow(1), 'head', seg=8, rings=5),
              cone(f'fangU{s}', (s * 0.06, -1.15, 1.07), (0, -0.1, -1), 0.022, 0.08, Be, FLAT, 'head', seg=4),
              cone(f'fangL{s}', (s * 0.06, -1.12, 1.05), (0, 0, 1), 0.018, 0.06, Be, FLAT, 'jaw', seg=4)]
        for k in range(3):  # blood stripes on the flanks
            p.append(box(f'stripe{s}{k}', (s * 0.27, -0.05 + k * 0.22, 0.98), (0.02, 0.07, 0.24), Mk, glow(0.3), 'body', rot=(18, 0, 0)))
    for k in range(6):  # bristling mane and bone spurs along the spine
        p.append(cone(f'mane{k}', ((k % 2 - 0.5) * 0.18, -0.6 + k * 0.08, 1.22 - k * 0.02), ((k % 2 - 0.5) * 0.6, 0.9, 0.6), 0.09, 0.32, Dk, FLAT, 'chest', seg=4))
    for k in range(4):
        p.append(cone(f'spur{k}', (0, -0.05 + k * 0.2, 1.16 - k * 0.02), (0, 0.5, 1), 0.04, 0.18 - k * 0.02, Be, FLAT, 'body', seg=4))
    for s in (-1, 1):
        sd = 'l' if s > 0 else 'r'
        p += [tube(f'fleg{s}', [(s * 0.2, -0.42, 0.92), (s * 0.22, -0.46, 0.5), (s * 0.22, -0.42, 0.12)], [0.11, 0.07, 0.06], Fu, FLAT, f'leg_f{sd}', seg=6),
              ellipsoid(f'fpaw{s}', (s * 0.22, -0.48, 0.05), (0.08, 0.12, 0.05), Dk, FLAT, f'leg_f{sd}', seg=6, rings=4),
              tube(f'bleg{s}', [(s * 0.2, 0.42, 0.9), (s * 0.22, 0.56, 0.56), (s * 0.22, 0.45, 0.3), (s * 0.22, 0.5, 0.1)], [0.14, 0.09, 0.06, 0.05], Fu, FLAT, f'leg_b{sd}', seg=6),
              ellipsoid(f'bpaw{s}', (s * 0.22, 0.45, 0.05), (0.08, 0.12, 0.05), Dk, FLAT, f'leg_b{sd}', seg=6, rings=4)]
        for c in range(2):
            p.append(cone(f'claw{s}{c}', (s * 0.22 + (c - 0.5) * 0.06, -0.58, 0.04), (0, -1, -0.3), 0.015, 0.07, Be, FLAT, f'leg_f{sd}', seg=4))
    body = finish(name, arm, p)
    anim(arm, 'Idle', 40, {'chest': [(0, {'s': 1}), (20, {'s': 1.04}), (40, {'s': 1})], 'head': rot_keys(40, (0, 10, 0), (4, -10, 0)), 'tail': rot_keys(40, (0, 15, 0), (0, -15, 0)),
                           'jaw': [(0, ZERO), (10, {'r': (10, 0, 0)}), (20, ZERO), (40, ZERO)]}, True)
    anim(arm, 'Walk', 16, {'leg_fl': pitch_gait(16, 0, 30), 'leg_br': pitch_gait(16, 0, 26), 'leg_fr': pitch_gait(16, 1, 30), 'leg_bl': pitch_gait(16, 1, 26),
                           'body': bob(16, 0, 0.06, 4), 'chest': rot_keys(16, (3, 0, 0), (-3, 0, 0), 4), 'head': rot_keys(16, (-3, 0, 0), (3, 0, 0), 4), 'tail': rot_keys(16, (8, 12, 0), (8, -12, 0))}, True)
    anim(arm, 'Attack', 24, {'root': [(0, {'l': (0, 0, 0)}), (8, {'l': (0, 0.15, -0.12)}), (12, {'l': (0, -0.9, 0.28)}), (16, {'l': (0, -1.0, 0)}), (24, {'l': (0, 0, 0)})],
                             'chest': [(0, ZERO), (8, {'r': (10, 0, 0)}), (12, {'r': (-12, 0, 0)}), (24, ZERO)],
                             'head': [(0, ZERO), (8, {'r': (10, 0, 0)}), (12, {'r': (-15, 0, 0)}), (16, {'r': (12, 0, 0)}), (24, ZERO)],
                             'jaw': [(0, ZERO), (10, {'r': (38, 0, 0)}), (14, {'r': (0, 0, 0)}), (24, ZERO)],
                             'leg_fl': [(0, ZERO), (8, {'r': (20, 0, 0)}), (12, {'r': (-55, 0, 0)}), (24, ZERO)], 'leg_fr': [(0, ZERO), (8, {'r': (20, 0, 0)}), (12, {'r': (-50, 0, 0)}), (24, ZERO)],
                             'leg_bl': [(0, ZERO), (8, {'r': (-20, 0, 0)}), (12, {'r': (35, 0, 0)}), (24, ZERO)], 'leg_br': [(0, ZERO), (8, {'r': (-20, 0, 0)}), (12, {'r': (35, 0, 0)}), (24, ZERO)]})
    anim(arm, 'Cast', 36, {'body': [(0, ZERO), (8, {'r': (-18, 0, 0)}), (30, {'r': (-18, 0, 0)}), (36, ZERO)], 'chest': [(0, ZERO), (8, {'r': (-14, 0, 0)}), (30, {'r': (-14, 0, 0)}), (36, ZERO)],
                           'head': [(0, ZERO), (8, {'r': (-40, 0, 0)}), (30, {'r': (-45, 0, 0)}), (36, ZERO)], 'jaw': [(0, ZERO), (8, {'r': (26, 0, 0)}), (30, {'r': (22, 0, 0)}), (36, ZERO)],
                           'leg_bl': [(0, ZERO), (8, {'r': (-30, 0, 0)}), (30, {'r': (-30, 0, 0)}), (36, ZERO)], 'leg_br': [(0, ZERO), (8, {'r': (-30, 0, 0)}), (30, {'r': (-30, 0, 0)}), (36, ZERO)],
                           'tail': [(0, ZERO), (8, {'r': (-20, 0, 0)}), (36, ZERO)]})
    anim(arm, 'Hit', 10, {'chest': [(0, ZERO), (3, {'r': (-12, 0, 8)}), (10, ZERO)], 'head': [(0, ZERO), (3, {'r': (-15, 0, 0)}), (10, ZERO)]})
    anim(arm, 'Death', 30, {'root': [(0, {'r': (0, 0, 0), 'l': (0, 0, 0)}), (14, {'r': (0, 0, 70), 'l': (0, 0, 0.1)}), (24, {'r': (0, 0, 88), 'l': (0, 0, 0)}), (30, {'r': (0, 0, 90), 'l': (0, 0, -0.05)})],
                            'head': [(0, ZERO), (24, {'r': (20, 0, 0)})], 'jaw': [(0, ZERO), (24, {'r': (25, 0, 0)})],
                            'leg_fl': [(0, ZERO), (24, {'r': (-25, 0, 0)})], 'leg_bl': [(0, ZERO), (24, {'r': (25, 0, 0)})]})
    anim(arm, 'Spawn', 24, {'root': [(0, {'l': (0, 0, -1.2)}), (16, {'l': (0, 0, 0.15)}), (24, {'l': (0, 0, 0)})], 'chest': [(0, {'r': (-30, 0, 0)}), (24, ZERO)],
                            'head': [(0, {'r': (-30, 0, 0)}), (24, ZERO)]})
    return arm, body

CREATURES = {
    'web_spider': lambda: spider('web_spider', dict(body=(0.3, 0.26, 0.22), dark=(0.16, 0.13, 0.11), leg=(0.22, 0.18, 0.15), band=(0.88, 0.85, 0.76), mark=(0.94, 0.92, 0.84), eye=(1.0, 0.16, 0.1), fang=(0.85, 0.82, 0.74), hair=True)),
    'venom_spider': lambda: spider('venom_spider', dict(body=(0.13, 0.08, 0.17), dark=(0.07, 0.05, 0.09), leg=(0.12, 0.08, 0.15), band=(0.45, 0.95, 0.2), mark=(0.5, 1.0, 0.22), markGlow=glow(0.8), eye=(0.55, 1.0, 0.25),
                                                    fang=(0.55, 1.0, 0.3), fangGlow=glow(0.6), sac=(0.5, 1.0, 0.2))),
    'soul_wraith': lambda: wraith('soul_wraith', dict(robe=(0.1, 0.14, 0.16), robe2=(0.16, 0.22, 0.24), eye=(0.35, 1.0, 0.85), hand=(0.55, 0.62, 0.58), hemGlow=(0.3, 0.95, 0.8), clawGlow=glow(0.35))),
    'banshee': lambda: wraith('banshee', dict(robe=(0.66, 0.73, 0.84), robe2=(0.8, 0.86, 0.94), robeGlow=glow(0.12), eye=(0.6, 0.88, 1.0), hand=(0.82, 0.86, 0.92), hair=(0.9, 0.94, 1.0)), banshee=True),
    'basilisk': lambda: lizard('basilisk', dict(scale=(0.38, 0.46, 0.24), dark=(0.2, 0.25, 0.13), belly=(0.74, 0.7, 0.45), eye=(1.0, 0.85, 0.15), crest=(0.86, 0.36, 0.14), mouth=(0.75, 0.25, 0.3), claw=(0.85, 0.8, 0.65))),
    'frost_lizard': lambda: lizard('frost_lizard', dict(scale=(0.42, 0.58, 0.72), dark=(0.2, 0.3, 0.45), belly=(0.82, 0.9, 0.96), eye=(0.5, 0.95, 1.0), crest=(0.62, 0.92, 1.0), mouth=(0.45, 0.85, 1.0), claw=(0.85, 0.95, 1.0)), frost=True),
    'myconid': lambda: myconid('myconid', dict(stem=(0.88, 0.82, 0.7), cap=(0.58, 0.22, 0.7), gill=(0.98, 0.72, 0.86), spot=(0.82, 1.0, 0.45), eye=(1.0, 0.75, 1.0), foot=(0.6, 0.5, 0.4))),
    'dire_wolf': lambda: wolf('dire_wolf', dict(fur=(0.3, 0.29, 0.31), dark=(0.16, 0.15, 0.17), mark=(0.75, 0.08, 0.06), bone=(0.92, 0.88, 0.78), eye=(1.0, 0.18, 0.1))),
}
