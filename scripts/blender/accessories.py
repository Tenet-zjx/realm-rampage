# Procedural add-on parts for KayKit-based variants. Every part is rigidly skinned to one bone.
import math
from mathutils import Vector
from kk import ellipsoid, box, cone, cylinder, tube, torus, plate, FLAT, GLOW

def glow(strength=1.0):
    return 0.5 + 0.5 * max(0.0, min(1.0, strength))

def horns(h, color, size=1.0, curl=1.0, mat=None, bone='head'):
    parts = []
    r = h['radius']
    for s in (-1, 1):
        base = Vector((s * r * 0.62, h['center'].y + 0.05, h['center'].z + r * 0.45))
        pts = [base + Vector((s * r * 0.45 * size * t, -0.08 * t * curl, r * 0.9 * size * math.sin(t * 1.2) + (0.15 * t * t * curl))) for t in (0, 0.33, 0.66, 1.0)]
        pts = [base, base + Vector((s * 0.22, 0.02, 0.18)) * size, base + Vector((s * 0.42, 0.06, 0.42)) * size, base + Vector((s * 0.48, 0.18 * curl, 0.70)) * size]
        parts.append(tube(f'horn{s}', pts, [0.11 * size, 0.085 * size, 0.055 * size, 0.025 * size], color, FLAT, bone, mat))
    return parts

def crown(h, color, spikes=7, height=0.28, radius_scale=0.78, alpha=FLAT, gem=None, mat=None, bone='head'):
    r = h['radius'] * radius_scale; z = h['top'] - 0.06
    c = Vector((h['center'].x, h['center'].y, z))
    parts = [torus('crown_band', c, r, 0.05, color, alpha, bone, mat)]
    for i in range(spikes):
        a = 2 * math.pi * i / spikes
        p = c + Vector((math.cos(a) * r, math.sin(a) * r, 0.02))
        parts.append(cone(f'crown_spike{i}', p, (math.cos(a) * 0.12, math.sin(a) * 0.12, 1), 0.065, height * (1.25 if i % 2 == 0 else 0.8), color, alpha, bone, mat, seg=5))
    if gem:
        parts.append(ellipsoid('crown_gem', c + Vector((0, -r - 0.03, 0.06)), (0.07, 0.05, 0.09), gem, glow(1), bone, mat, seg=8, rings=6))
    return parts

def ice_crown(h, color, mat=None, bone='head'):
    r = h['radius'] * 0.7; z = h['top'] - 0.1
    parts = []
    for i in range(9):
        a = 2 * math.pi * i / 9; tall = 0.55 if i in (0, 4, 5) else 0.32 + 0.08 * (i % 2)
        p = Vector((h['center'].x + math.cos(a) * r, h['center'].y + math.sin(a) * r, z))
        parts.append(cone(f'ice{i}', p, (math.cos(a) * 0.35, math.sin(a) * 0.35, 1), 0.08, tall, color, glow(0.35), bone, mat, seg=4))
    return parts

def flame_crest(h, color, mat=None, bone='head'):
    parts = []
    for i, (dx, tall) in enumerate(((-0.18, 0.35), (0, 0.55), (0.18, 0.35), (-0.08, 0.42), (0.08, 0.42))):
        p = Vector((h['center'].x + dx, h['center'].y + 0.05, h['top'] - 0.12))
        parts.append(cone(f'flame{i}', p, (dx * 0.6, 0.15, 1), 0.1, tall, color, glow(1), bone, mat, seg=5))
    return parts

def eye_glow(h, color, spacing=0.17, size=0.07, mat=None, bone='head', z_off=0.0):
    parts = []
    for s in (-1, 1):
        p = Vector((h['center'].x + s * spacing, h['front'] + 0.05, h['center'].z + 0.02 + z_off))
        parts.append(ellipsoid(f'eye{s}', p, (size, size * 0.6, size * 0.7), color, glow(1), bone, mat, seg=8, rings=5))
    return parts

def shoulder_spikes(arm, color, count=3, size=1.0, mat=None, plate=None):
    from kk import bone_head
    parts = []
    for side, bone in ((-1, 'upperarm.r'), (1, 'upperarm.l')):
        p = bone_head(arm, bone)
        sgn = 1 if p.x > 0 else -1
        if plate:
            parts.append(ellipsoid(f'pauldron{bone}', p + Vector((sgn * 0.06, 0, 0.1)), (0.32 * size, 0.3 * size, 0.2 * size), plate, FLAT, bone, mat, seg=10, rings=6))
        for i in range(count):
            off = Vector((sgn * (0.12 + 0.05 * i), -0.12 + 0.12 * i, 0.22 * size))
            parts.append(cone(f'spike{bone}{i}', p + off, (sgn * 0.5, 0, 1), 0.07 * size, 0.32 * size, color, FLAT, bone, mat, seg=5))
    return parts

def chest_core(arm, color, radius=0.16, mat=None, forward=0.3):
    from kk import bone_head
    p = bone_head(arm, 'chest') + Vector((0, -forward, 0.22))
    return [ellipsoid('core', p, (radius, radius * 0.7, radius), color, glow(1), 'chest', mat, seg=10, rings=7)]

def halo(h, color, mat=None):
    c = Vector((h['center'].x, h['center'].y + 0.12, h['top'] + 0.22))
    return [torus('halo', c, h['radius'] * 0.75, 0.045, color, glow(1), 'head', mat, seg=24, tseg=5, rot=(12, 0, 0))]

def wings(arm, color, edge, size=1.0, mat=None):
    from kk import bone_head
    base = bone_head(arm, 'chest') + Vector((0, 0.35, 0.45))
    parts = []
    for s in (-1, 1):
        for i in range(6):
            a = math.radians(15 + i * 15)
            length = (1.5 - abs(i - 2) * 0.14) * size
            d = Vector((s * math.cos(a), 0.35, math.sin(a) * 0.9 + 0.1))
            root = base + Vector((s * 0.12, 0, 0))
            tip = root + d.normalized() * length
            side = Vector((0, 0, 0.13 * size)) if abs(d.z) < 0.9 else Vector((0.13 * size, 0, 0))
            parts.append(plate(f'feather{s}{i}', [root - side * 0.6, tip - side * 0.35, tip + d.normalized() * 0.18 * size, tip + side, root + side * 0.6], (0, 1, 0), 0.04, color, FLAT, 'chest', mat))
            parts.append(ellipsoid(f'feathertip{s}{i}', tip, (0.12 * size, 0.04, 0.09 * size), edge, glow(0.8), 'chest', mat, seg=6, rings=4))
    return parts

def banner(arm, pole, cloth, emblem, mat=None):
    from kk import bone_head
    c = bone_head(arm, 'chest') + Vector((0, 0.32, 0))
    parts = [cylinder('pole', c + Vector((0, 0, -0.3)), c + Vector((0, 0, 2.2)), 0.04, pole, FLAT, 'chest', mat)]
    parts.append(box('flag', c + Vector((0.3, 0.02, 1.75)), (0.6, 0.03, 0.8), cloth, FLAT, 'chest', mat))
    parts.append(ellipsoid('emblem', c + Vector((0.3, -0.01, 1.78)), (0.14, 0.03, 0.14), emblem, glow(0.7), 'chest', mat, seg=8, rings=5))
    parts.append(cone('finial', c + Vector((0, 0, 2.2)), (0, 0, 1), 0.07, 0.2, emblem, FLAT, 'chest', mat, seg=5))
    return parts

def staff_orb(tip, color, mat=None, bone='handslot.r', radius=0.15):
    return [ellipsoid('orb', tip, (radius, radius, radius), color, glow(1), bone, mat, seg=10, rings=8)]

def back_spikes(arm, color, mat=None, n=5):
    from kk import bone_head
    c = bone_head(arm, 'chest') + Vector((0, 0.28, 0.0))
    return [cone(f'bspike{i}', c + Vector(((i - (n - 1) / 2) * 0.14, 0, 0.1 + 0.08 * (n // 2 - abs(i - n // 2)))), (0, 0.6, 1), 0.08, 0.45 + 0.1 * (n // 2 - abs(i - n // 2)), color, FLAT, 'chest', mat, seg=5) for i in range(n)]

# ---- v1.1 special-enemy parts ----
def _frame(axis):
    """Orthonormal (u, v) perpendicular to axis."""
    axis = Vector(axis).normalized()
    u = axis.cross(Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))).normalized()
    return axis, u, axis.cross(u).normalized()

def mask(h, color, trim, eye, mat=None, bone='head'):
    """Tribal hex mask over the face: carved plate, glowing slit eyes, painted stripes and teeth."""
    c, r, f = h['center'], h['radius'], h['front'] - 0.04
    pts = [(c.x + x * r, f, c.z + z * r) for x, z in ((-0.72, 0.62), (0, 0.9), (0.72, 0.62), (0.86, -0.08), (0.46, -0.78), (0, -0.98), (-0.46, -0.78), (-0.86, -0.08))]
    parts = [plate('mask', pts, (0, 1, 0), 0.06, color, FLAT, bone, mat),
             box('maskRidge', (c.x, f - 0.04, c.z + 0.3 * r), (0.1 * r, 0.04, 0.55 * r), trim, FLAT, bone, mat)]
    for s in (-1, 1):
        parts += [ellipsoid(f'maskEye{s}', (c.x + s * 0.34 * r, f - 0.04, c.z + 0.12 * r), (0.13 * r, 0.03, 0.07 * r), eye, glow(1), bone, mat, seg=8, rings=5, rot=(0, s * 12, 0)),
                  box(f'maskStripe{s}', (c.x + s * 0.55 * r, f - 0.035, c.z - 0.38 * r), (0.09 * r, 0.02, 0.48 * r), trim, FLAT, bone, mat)]
    for k in range(5):
        parts.append(cone(f'maskTooth{k}', (c.x + (k - 2) * 0.13 * r, f - 0.04, c.z - 0.6 * r), (0, 0, -1), 0.04 * r, 0.16 * r, (0.95, 0.92, 0.82), FLAT, bone, mat, seg=4))
    return parts

def feathers(h, colors, mat=None, bone='head', n=5, length=0.6):
    c, r = h['center'], h['radius']; parts = []
    for i in range(n):
        a = math.radians(-55 + i * 110 / (n - 1))
        root = Vector((c.x + math.sin(a) * r * 0.55, c.y + r * 0.35, h['top'] - 0.12))
        d = Vector((math.sin(a) * 0.55, 0.4, 1)).normalized(); tip = root + d * length * (1.1 - abs(i - (n - 1) / 2) * 0.12)
        side = d.cross(Vector((0, 1, 0))).normalized() * 0.08
        nrm = d.cross(side).normalized()
        col = colors[i % len(colors)]
        parts += [plate(f'feather{i}', [root - side * 0.3, tip - side, tip + d * 0.14, tip + side, root + side * 0.3], nrm, 0.025, col, FLAT, bone, mat),
                  cylinder(f'quill{i}', root, tip + d * 0.1, 0.012, (0.95, 0.9, 0.8), FLAT, bone, mat, seg=4)]
    return parts

def hourglass(tip, axis, frame, sand, mat=None, bone='handslot.r', size=1.0):
    ax, u, v = _frame(axis)
    c = tip + ax * 0.24 * size; h = 0.2 * size
    parts = [cone('hgTop', c + ax * h, -ax, 0.13 * size, h, sand, glow(0.55), bone, mat, seg=8),
             cone('hgBot', c - ax * h, ax, 0.13 * size, h, sand, glow(0.55), bone, mat, seg=8),
             cylinder('hgCapT', c + ax * h, c + ax * (h + 0.04 * size), 0.16 * size, frame, FLAT, bone, mat, seg=8),
             cylinder('hgCapB', c - ax * (h + 0.04 * size), c - ax * h, 0.16 * size, frame, FLAT, bone, mat, seg=8),
             ellipsoid('hgCore', c, (0.05 * size, 0.05 * size, 0.05 * size), sand, glow(1), bone, mat, seg=6, rings=4)]
    for k in range(3):
        a = 2 * math.pi * k / 3; o = (u * math.cos(a) + v * math.sin(a)) * 0.14 * size
        parts.append(cylinder(f'hgPost{k}', c - ax * h + o, c + ax * h + o, 0.016 * size, frame, FLAT, bone, mat, seg=4))
    return parts

def clock_halo(h, ring, hands, mat=None, bone='head'):
    c, r = h['center'], h['radius']
    o = Vector((c.x, c.y + r * 0.95, c.z + r * 0.25)); R = r * 1.25
    parts = [torus('clockRing', o, R, 0.035, ring, glow(0.8), bone, mat, seg=28, tseg=4, rot=(90, 0, 0)),
             torus('clockInner', o, R * 0.72, 0.018, ring, glow(0.5), bone, mat, seg=24, tseg=4, rot=(90, 0, 0))]
    for k in range(12):
        a = 2 * math.pi * k / 12
        parts.append(box(f'tick{k}', o + Vector((math.cos(a) * R * 0.86, 0, math.sin(a) * R * 0.86)), (0.035, 0.02, 0.11 if k % 3 == 0 else 0.06), hands, glow(0.9), bone, mat, rot=(0, -math.degrees(a) + 90, 0)))
    parts += [box('handHour', o + Vector((0.12 * R, -0.01, 0.12 * R)), (0.03, 0.02, 0.38 * R), hands, glow(1), bone, mat, rot=(0, -45, 0)),
              box('handMin', o + Vector((-0.2 * R, -0.01, 0.12 * R)), (0.025, 0.02, 0.55 * R), hands, glow(1), bone, mat, rot=(0, 60, 0))]
    return parts

def rune_ring(arm, color, mat=None, radius=0.62, n=6):
    from kk import bone_head
    c = bone_head(arm, 'chest') + Vector((0, 0, 0.12))
    parts = [torus('runeRing', c, radius, 0.022, color, glow(0.85), 'chest', mat, seg=30, tseg=4, rot=(8, 0, 0))]
    for k in range(n):
        a = 2 * math.pi * k / n
        p = c + Vector((math.cos(a) * radius, math.sin(a) * radius, math.sin(a) * radius * math.sin(math.radians(8))))
        parts += [box(f'rune{k}', p, (0.09, 0.09, 0.13), color, glow(1), 'chest', mat, rot=(0, 0, math.degrees(a))),
                  box(f'runeBar{k}', p + Vector((0, 0, 0.1)), (0.11, 0.03, 0.03), color, glow(0.7), 'chest', mat, rot=(0, 0, math.degrees(a)))]
    return parts

def hook_head(tip, axis, metal, edge, mat=None, bone='handslot.r'):
    """Jailer's polearm: a heavy curved hook with a chain loop at the tip of a staff."""
    ax, u, v = _frame(axis)
    base = tip - ax * 0.05
    pts = [base, base + ax * 0.22, base + ax * 0.42 + u * 0.08, base + ax * 0.5 + u * 0.28, base + ax * 0.4 + u * 0.44, base + ax * 0.22 + u * 0.46]
    parts = [tube('hook', pts, [0.06, 0.06, 0.055, 0.045, 0.035, 0.015], metal, FLAT, bone, mat, seg=6),
             tube('hookEdge', [p + v * 0.0 - u * 0.0 for p in pts[2:]], [0.03, 0.03, 0.022, 0.01], edge, glow(0.4), bone, mat, seg=4),
             cone('spike', base + ax * 0.2, -u, 0.04, 0.22, metal, FLAT, bone, mat, seg=4)]
    for k in range(4):
        parts.append(torus(f'hookLink{k}', base - ax * (0.05 + k * 0.09) - u * 0.07, 0.045, 0.013, metal, FLAT, bone, mat, seg=8, tseg=4, rot=(90 if k % 2 else 0, 0, 0)))
    return parts

def chain_sash(arm, metal, mat=None, n=12):
    """Chain worn diagonally across the chest, ending in a shackle."""
    from kk import bone_head
    a, b = bone_head(arm, 'upperarm.l') + Vector((0, -0.08, 0.12)), bone_head(arm, 'hips') + Vector((-0.28, -0.3, 0.05))
    parts = []
    for k in range(n):
        t = k / (n - 1); p = a.lerp(b, t) + Vector((0, -0.08 * math.sin(t * math.pi), 0))
        parts.append(torus(f'sash{k}', p, 0.05, 0.016, metal, FLAT, 'chest', mat, seg=8, tseg=4, rot=(90, 0, 45) if k % 2 else (0, 35, 0)))
    parts.append(torus('shackle', b + Vector((0, 0, -0.1)), 0.09, 0.025, metal, FLAT, 'hips', mat, seg=10, tseg=4, rot=(90, 0, 0)))
    return parts

def bomb(center, radius, shell, fuse, spark, mat=None, bone='handslot.r', name='bomb'):
    up = Vector((0, 0, 1))
    return [ellipsoid(f'{name}Shell', center, (radius, radius, radius), shell, FLAT, bone, mat, seg=10, rings=7),
            torus(f'{name}Band', center, radius * 1.0, radius * 0.12, fuse, FLAT, bone, mat, seg=14, tseg=4),
            cylinder(f'{name}Neck', center + up * radius * 0.85, center + up * radius * 1.15, radius * 0.25, shell, FLAT, bone, mat, seg=6),
            tube(f'{name}Fuse', [center + up * radius * 1.1, center + up * radius * 1.4 + Vector((0.05, 0, 0)), center + up * radius * 1.6 + Vector((0.02, -0.04, 0))], [0.025, 0.02, 0.015], fuse, FLAT, bone, mat, seg=4),
            ellipsoid(f'{name}Spark', center + up * radius * 1.7 + Vector((0.02, -0.05, 0)), (0.05, 0.05, 0.05), spark, glow(1), bone, mat, seg=6, rings=4)]

def bomb_pack(arm, wood, band, shell, fuse, spark, mat=None):
    from kk import bone_head
    c = bone_head(arm, 'chest') + Vector((0, 0.36, 0.05))
    parts = [cylinder('keg', c + Vector((0, 0, -0.3)), c + Vector((0, 0, 0.32)), 0.25, wood, FLAT, 'chest', mat, seg=10),
             torus('kegBandT', c + Vector((0, 0, 0.2)), 0.255, 0.025, band, FLAT, 'chest', mat, seg=14, tseg=4),
             torus('kegBandB', c + Vector((0, 0, -0.18)), 0.255, 0.025, band, FLAT, 'chest', mat, seg=14, tseg=4),
             tube('kegFuse', [c + Vector((0, 0, 0.32)), c + Vector((0.08, 0.05, 0.5)), c + Vector((0.18, 0.02, 0.58))], [0.03, 0.025, 0.02], fuse, FLAT, 'chest', mat, seg=4),
             ellipsoid('kegSpark', c + Vector((0.2, 0.02, 0.62)), (0.07, 0.07, 0.07), spark, glow(1), 'chest', mat, seg=6, rings=4)]
    hp = bone_head(arm, 'hips')
    for k in range(4):  # belt of little bombs
        a = math.radians(-60 + k * 40)
        parts += bomb(hp + Vector((math.sin(a) * 0.36, -math.cos(a) * 0.3, 0.1)), 0.09, shell, fuse, spark, mat, 'hips', f'belt{k}')
    return parts
