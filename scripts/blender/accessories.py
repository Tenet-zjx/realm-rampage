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
