# Entry point: blender --background --factory-startup --python scripts/blender/build.py -- --export [--only id,id]
# Rebuilds every shipped model from the pinned KayKit sources (art/source/kaykit) plus the procedural
# monsters in monsters.py, then writes public/assets/models/manifest.json.
import sys, json, hashlib, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector
import kk
from kk import SRC, OUT, reset, import_gltf, armature_of, gltf_json, attach_item, set_color, join, recolor, save_png, base_material, material_image, export_glb, head_info, bone_head, FLAT
import accessories as acc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None

ADV = SRC / 'adventurers'; SKL = SRC / 'skeletons'
CHAR = {'Knight': ADV / 'Characters/gltf/Knight.glb', 'Barbarian': ADV / 'Characters/gltf/Barbarian.glb', 'Mage': ADV / 'Characters/gltf/Mage.glb',
        'Rogue': ADV / 'Characters/gltf/Rogue.glb', 'Rogue_Hooded': ADV / 'Characters/gltf/Rogue_Hooded.glb',
        'Minion': SKL / 'Characters/gltf/Skeleton_Minion.glb', 'Warrior': SKL / 'Characters/gltf/Skeleton_Warrior.glb',
        'SRogue': SKL / 'Characters/gltf/Skeleton_Rogue.glb', 'SMage': SKL / 'Characters/gltf/Skeleton_Mage.glb'}
ITEM = lambda n: (SKL / f'Assets/gltf/Skeleton_{n}.gltf') if not n.islower() else (ADV / f'Assets/gltf/{n}.gltf')

# Clips kept in the shared animation library (all KayKit characters share one 41-bone rig).
CLIPS = ['Idle', 'Idle_B', 'Idle_Combat', '2H_Melee_Idle', 'Walking_A', 'Walking_B', 'Walking_D_Skeletons', 'Running_A', 'Running_B', 'Running_C',
         'Dodge_Forward', 'Dodge_Backward',
         '1H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab',
         '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Spinning', '2H_Melee_Attack_Stab',
         'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab', 'Unarmed_Melee_Attack_Kick',
         '1H_Ranged_Shoot', '1H_Ranged_Aiming', 'Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Raise', 'Spellcast_Summon', 'Spellcasting', 'Throw',
         'Block', 'Blocking', 'Hit_A', 'Hit_B', 'Death_A', 'Death_B', 'Death_C_Skeletons', 'Cheer', 'Taunt',
         'Jump_Full_Short', 'Jump_Idle', 'Skeletons_Awaken_Floor']

WHITE = (1, 1, 1)
# ---- recolour presets ----
P = {
    'blood': [{'tint': (1.0, 0.25, 0.2), 'amount': 0.55}, {'val': 0.85}],
    'frost': [{'tint': (0.55, 0.85, 1.0), 'amount': 0.55}, {'val': 1.05}],
    'char': [{'val': 0.42}, {'tint': (1.0, 0.55, 0.3), 'amount': 0.2}],
    'steel': [{'tint': (0.7, 0.8, 0.95), 'amount': 0.35}, {'val': 0.9}],
    'dark_bone': [{'tint': (0.75, 0.68, 0.55), 'amount': 0.45}, {'val': 0.75}],
    'shadow': [{'tint': (0.55, 0.4, 0.85), 'amount': 0.6}, {'val': 0.55}],
    'ember': [{'tint': (1.0, 0.5, 0.25), 'amount': 0.5}, {'val': 0.6}],
    'plague': [{'tint': (0.6, 0.95, 0.4), 'amount': 0.5}, {'val': 0.8}],
    'gilded': [{'tint': (1.0, 0.85, 0.5), 'amount': 0.45}],
    'abyss': [{'set_hue': 285, 'min_sat': 0.12, 'protect_skin': False, 'sat': 1.2}, {'val': 0.6}],
    'fallen': [{'set_hue': 352, 'min_sat': 0.2, 'sat': 1.1}, {'val': 0.42, 'max_sat': 0.25}, {'val': 0.7}],
    'seraph': [{'set_hue': 45, 'min_sat': 0.2, 'protect_skin': True, 'sat': 0.9}, {'val': 0.5, 'max_sat': 0.2}],
    'twin_flame': [{'tint': (1.0, 0.35, 0.15), 'amount': 0.55}, {'val': 0.9}],
    'twin_frost': [{'tint': (0.35, 0.6, 1.0), 'amount': 0.55}],
    'sovereign': [{'tint': (0.6, 0.45, 0.9), 'amount': 0.5}, {'val': 0.62}],
    'necro': [{'tint': (0.55, 0.9, 0.6), 'amount': 0.3}, {'val': 0.85}],
}
EYE = {'red': (1.0, 0.12, 0.05), 'cyan': (0.3, 0.95, 1.0), 'orange': (1.0, 0.5, 0.05), 'blue': (0.35, 0.55, 1.0), 'gold': (1.0, 0.8, 0.2),
       'violet': (0.75, 0.3, 1.0), 'green': (0.4, 1.0, 0.3), 'yellow': (1.0, 1.0, 0.19)}

def heroes():
    return {
        'knight': dict(base='Knight', keep=['1H_Sword', 'Badge_Shield'], skins=[('圣誓', None), ('暗夜', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 260, 'sat': 0.8}, {'max_sat': 0.15, 'val': 0.55}]), ('辉金', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 42, 'sat': 1.1}])]),
        'barbarian': dict(base='Barbarian', keep=['2H_Axe'], skins=[('狂战', None), ('冰原', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 200}]), ('血怒', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 355, 'sat': 1.2}, {'max_sat': 0.15, 'val': 0.6}])]),
        'mage': dict(base='Mage', keep=['2H_Staff', 'Spellbook_open'], skins=[('星辉', None), ('烈焰', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 12, 'sat': 1.1}]), ('翠林', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 130}])]),
        'rogue': dict(base='Rogue', keep=['Knife', 'Knife_Offhand'], skins=[('影刃', None), ('赤蝎', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 5, 'sat': 1.1}]), ('霜刃', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 195}])]),
        'assassin': dict(base='Rogue_Hooded', keep=['1H_Crossbow', 'Knife_Offhand'], skins=[('夜行', None), ('紫魇', [{'min_sat': 0.15, 'protect_skin': True, 'set_hue': 280}]), ('白鸦', [{'max_sat': 0.4, 'val': 1.4, 'val_add': 0.1}, {'min_sat': 0.15, 'protect_skin': True, 'sat': 0.3}])]),
        'necromancer': dict(base='SMage', items=[('Staff', 'r'), ('spellbook_open', 'l')], eye='green', tint='necro',
                            acc=lambda a, h, m: acc.crown(h, (0.22, 0.3, 0.2), 5, 0.24, 0.62, FLAT, (0.4, 1.0, 0.3), m),
                            skins=[('亡骨', None), ('血契', [{'tint': (1.0, 0.3, 0.3), 'amount': 0.4}]), ('幽冥', [{'tint': (0.5, 0.5, 1.0), 'amount': 0.45}, {'val': 0.7}])]),
    }

def enemies():
    return {
        'skel_minion': dict(base='Minion', items=[('Blade', 'r')], eye='yellow'),
        'skel_warrior': dict(base='Warrior', items=[('Axe', 'r'), ('Shield_Small_A', 'shield')], eye='yellow'),
        'skel_archer': dict(base='SRogue', items=[('Crossbow', 'r')], eye='yellow'),
        'skel_mage': dict(base='SMage', items=[('Staff', 'r')], eye='yellow', orb=(0.95, 0.85, 0.3)),
        'blood_berserker': dict(base='Warrior', items=[('Axe', 'r'), ('Axe', 'l')], tint='blood', eye='red', acc=lambda a, h, m: acc.horns(h, (0.92, 0.88, 0.8), 0.8, 1, m)),
        'frost_wizard': dict(base='SMage', items=[('Staff', 'r')], tint='frost', eye='cyan', orb=(0.4, 0.9, 1.0), acc=lambda a, h, m: acc.ice_crown(h, (0.6, 0.9, 1.0), m)),
        'hellfire_skull': dict(base='Minion', items=[], tint='char', eye='orange', acc=lambda a, h, m: acc.flame_crest(h, (1.0, 0.45, 0.08), m) + acc.chest_core(a, (1.0, 0.35, 0.05), 0.2, m)),
        'bone_shieldguard': dict(base='Warrior', items=[('Blade', 'r'), ('Shield_Large_A', 'shield')], tint='steel', eye='blue', acc=lambda a, h, m: acc.shoulder_spikes(a, (0.75, 0.78, 0.85), 1, 1.0, m, plate=(0.45, 0.5, 0.6))),
        'bone_giant': dict(base='Warrior', items=[('Axe', 'r')], tint='dark_bone', eye='orange', acc=lambda a, h, m: acc.shoulder_spikes(a, (0.85, 0.8, 0.7), 3, 1.1, m) + acc.horns(h, (0.85, 0.8, 0.7), 0.55, 0.6, m)),
        'shadow_stalker': dict(base='SRogue', items=[('Blade', 'r'), ('Blade', 'l')], tint='shadow', eye='violet'),
        'ember_archer': dict(base='SRogue', items=[('Crossbow', 'r')], tint='ember', eye='orange', acc=lambda a, h, m: acc.flame_crest(h, (1.0, 0.5, 0.1), m)[1:2]),
        'plague_shaman': dict(base='SMage', items=[('Staff', 'r')], tint='plague', eye='green', orb=(0.45, 1.0, 0.25), acc=lambda a, h, m: acc.horns(h, (0.5, 0.65, 0.35), 0.5, 1.4, m)),
        'bone_standard': dict(base='Minion', items=[('Blade', 'r')], tint='gilded', eye='gold', acc=lambda a, h, m: acc.banner(a, (0.45, 0.32, 0.2), (0.7, 0.1, 0.1), (1.0, 0.8, 0.25), m)),
    }

def tests():
    return {'test_knight_items': dict(base='Knight', keep=[], items=[('sword_1handed', 'r'), ('shield_badge', 'shield')]),
            'test_minion_native': dict(base='Minion', items=[('Blade', 'r'), ('Shield_Small_A', 'shield')])}

def bosses():
    return {
        'boss_bone_colossus': dict(base='Warrior', items=[('Axe', 'r'), ('Shield_Large_B', 'shield')], tint='dark_bone', eye='red',
                                   acc=lambda a, h, m: acc.crown(h, (0.9, 0.7, 0.25), 7, 0.3, 0.8, FLAT, (1, 0.2, 0.1), m) + acc.shoulder_spikes(a, (0.9, 0.85, 0.75), 3, 1.2, m, plate=(0.5, 0.45, 0.4)) + acc.back_spikes(a, (0.9, 0.85, 0.75), m)),
        'boss_frost_lich': dict(base='SMage', items=[('Staff', 'r')], tint='frost', eye='cyan', orb=(0.4, 0.95, 1.0),
                                acc=lambda a, h, m: acc.ice_crown(h, (0.65, 0.95, 1.0), m) + acc.shoulder_spikes(a, (0.6, 0.9, 1.0), 3, 1.0, m) + acc.chest_core(a, (0.3, 0.9, 1.0), 0.13, m)),
        'boss_fallen_knight': dict(base='Knight', keep=['2H_Sword'], tint='fallen', eye='red',
                                   acc=lambda a, h, m: acc.horns(h, (0.15, 0.12, 0.12), 1.0, 1.2, m) + acc.shoulder_spikes(a, (0.2, 0.15, 0.15), 3, 1.1, m) + acc.eye_glow(h, (1, 0.1, 0.05), 0.16, 0.06, m)),
        'boss_abyss_lord': dict(base='Barbarian', keep=['2H_Axe'], tint='abyss', eye='violet',
                                acc=lambda a, h, m: acc.horns(h, (0.2, 0.1, 0.25), 1.3, 1.5, m) + acc.chest_core(a, (0.8, 0.25, 1.0), 0.18, m) + acc.eye_glow(h, (0.85, 0.3, 1.0), 0.15, 0.06, m) + acc.back_spikes(a, (0.3, 0.15, 0.35), m)),
        'boss_fallen_seraph': dict(base='Mage', keep=['2H_Staff'], tint='seraph', eye='gold',
                                   acc=lambda a, h, m: acc.halo(h, (1.0, 0.85, 0.35), m) + acc.wings(a, (0.12, 0.1, 0.14), (1.0, 0.8, 0.3), 1.0, m) + acc.eye_glow(h, (1.0, 0.85, 0.3), 0.15, 0.05, m)),
        'boss_twin_flame': dict(base='Warrior', items=[('Axe', 'r'), ('Axe', 'l')], tint='twin_flame', eye='orange',
                                acc=lambda a, h, m: acc.crown(h, (1.0, 0.75, 0.2), 5, 0.26, 0.8, FLAT, (1, 0.3, 0.05), m) + acc.flame_crest(h, (1.0, 0.45, 0.1), m)[:3]),
        'boss_twin_frost': dict(base='SRogue', items=[('Blade', 'r'), ('Blade', 'l')], tint='twin_frost', eye='cyan',
                                acc=lambda a, h, m: acc.crown(h, (0.8, 0.85, 0.95), 5, 0.26, 0.8, FLAT, (0.3, 0.8, 1), m)),
        'boss_bone_sovereign': dict(base='Minion', items=[('Staff', 'r')], tint='sovereign', eye='violet', orb=(0.8, 0.3, 1.0),
                                    acc=lambda a, h, m: acc.crown(h, (0.85, 0.75, 0.95), 9, 0.4, 0.85, acc.glow(0.3), (0.8, 0.3, 1), m) + acc.back_spikes(a, (0.85, 0.8, 0.9), m, 7) + acc.chest_core(a, (0.75, 0.3, 1.0), 0.15, m)),
    }

def img_key(m):
    try: return Path(material_image(m).filepath or material_image(m).name).name.split('.')[0]
    except StopIteration: return None

def build_character(mid, d, single_material):
    reset()
    objs = import_gltf(CHAR[d['base']])
    arm = armature_of(objs)
    arm.data.pose_position = 'REST'
    if arm.animation_data: arm.animation_data_clear()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for pb in arm.pose.bones: pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    src_json = gltf_json(CHAR['Knight'])
    meshes = [o for o in objs if o.type == 'MESH']
    keep = set(d.get('keep', []))
    for o in list(meshes):
        if o.parent_type == 'BONE':
            if o.name.split('.')[0] in keep:
                kk.rigid_to_bone(o, o.parent_bone if o.parent_bone else 'handslot.r')
            else:
                meshes.remove(o); bpy.data.objects.remove(o, do_unlink=True)
    h = head_info([o for o in meshes if o.parent_type != 'BONE'])
    for name, slot in d.get('items', []):
        meshes += attach_item(src_json, ITEM(name), slot)
    mat = base = base_material(meshes)
    img = material_image(mat)
    if d.get('tint'):
        new = recolor(img, P[d['tint']], f'{mid}_tex')
        mat = mat.copy(); mat.name = f'{mid}_mat'
        next(n for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeTexImage').image = new
    eye = EYE.get(d.get('eye', 'yellow'))
    for o in meshes:
        is_glow = any(s.material and s.material.name.startswith('Glow') for s in o.material_slots)
        set_color(o, (*eye, 1.0) if is_glow else (1, 1, 1, 0))
        kk.ensure_uv(o)
        if single_material or is_glow:
            o.data.materials.clear(); o.data.materials.append(mat)
        else:
            for s in o.material_slots:
                if s.material and s.material != mat and img_key(s.material) == img_key(base): s.material = mat
    if d.get('orb'):
        staff = [o for o in meshes if o.vertex_groups.get('handslot.r')]
        hand = bone_head(arm, 'handslot.r')
        tip = max((o.matrix_world @ v.co for o in staff for v in o.data.vertices), key=lambda p: (p - hand).length, default=hand)
        meshes += acc.staff_orb(tip, d['orb'], mat)
    if d.get('acc'):
        meshes += d['acc'](arm, h, mat)
    body = next(o for o in meshes if 'Body' in o.name)
    for o in meshes:
        if not any(m.type == 'ARMATURE' for m in o.modifiers):
            o.modifiers.new('Armature', 'ARMATURE').object = arm
        if o.parent is None: o.parent = arm; o.matrix_parent_inverse = arm.matrix_world.inverted()
    join(meshes, body)
    body.name = mid
    if single_material:
        for p in body.data.polygons: p.material_index = 0
        while len(body.data.materials) > 1: body.data.materials.pop(index=len(body.data.materials) - 1)
    return arm, body, mat, img

def export_char(kind, mid, d, single):
    arm, body, mat, img = build_character(mid, d, single)
    path = export_glb(OUT / kind / f'{mid}.glb', [arm, body])
    extra = {}
    if d.get('skins'):
        files = []
        for i, (label, ops) in enumerate(d['skins']):
            if ops is None: files.append({'name': label, 'file': None}); continue
            src_img = material_image(mat) if d.get('tint') else img
            sk = recolor(src_img, ops, f'{mid}_skin{i}')
            rel = f'{kind}/skins/{mid}_{i}.png'; save_png(sk, OUT / rel)
            files.append({'name': label, 'file': rel})
        extra['skins'] = files
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    return path, {'triangles': tris, **extra}

def build_anims():
    reset()
    objs = import_gltf(CHAR['Minion'])
    arm = armature_of(objs)
    for o in objs:
        if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    keep = set(CLIPS)
    if arm.animation_data:
        for t in list(arm.animation_data.nla_tracks):
            if not any(s.action and s.action.name in keep for s in t.strips): arm.animation_data.nla_tracks.remove(t)
        arm.animation_data.action = None
    for a in list(bpy.data.actions):
        if a.name not in keep: bpy.data.actions.remove(a)
        else: a.use_fake_user = True
    missing = keep - {a.name for a in bpy.data.actions}
    if missing: print('MISSING CLIPS', missing)
    path = export_glb(OUT / 'anims.glb', [arm], animations=True, skins=False, frame_step=2)
    return path, {'clips': sorted(a.name for a in bpy.data.actions)}

PROPS = ['wall', 'wall_arched', 'wall_broken', 'wall_corner', 'wall_cracked', 'wall_doorway', 'wall_half', 'wall_pillar', 'wall_gated',
         'pillar', 'pillar_decorated', 'column', 'barrier', 'barrier_column', 'barrier_corner', 'barrier_half', 'rubble_half', 'rubble_large',
         'barrel_large', 'barrel_large_decorated', 'barrel_small', 'barrel_small_stack', 'box_large', 'box_small', 'crates_stacked', 'chest', 'chest_gold',
         'coin', 'coin_stack_small', 'coin_stack_large', 'torch_lit', 'torch_mounted', 'candle_triple', 'floor_tile_large', 'floor_tile_large_rocks',
         'floor_tile_small_broken_A', 'floor_dirt_large', 'floor_dirt_large_rocky', 'floor_tile_big_spikes', 'sword_shield_broken', 'keg', 'table_long_broken',
         'trunk_large_A', 'banner_patternA_red', 'banner_patternA_blue', 'banner_shield_red', 'banner_shield_green', 'banner_thin_blue']

def build_props():
    reset()
    roots = []; shared = None
    for p in PROPS:
        path = next(x for x in [SRC / f'dungeon/Assets/gltf/{p}.gltf.glb', SRC / f'dungeon/Assets/gltf/{p}.glb'] if x.exists())
        objs = import_gltf(path)
        for i, o in enumerate(objs): o.name = f'{p}__{i}'
        empty = bpy.data.objects.new(p, None); bpy.context.scene.collection.objects.link(empty)
        for o in objs:
            if o.parent is None: o.parent = empty
            if o.type == 'MESH':
                for s in o.material_slots:
                    if s.material is None: continue
                    if shared is None: shared = s.material
                    elif s.material.name.split('.')[0] == shared.name.split('.')[0]: s.material = shared
        roots.append(empty)
    for i, e in enumerate(roots): e.location = ((i % 8) * 6.0, (i // 8) * 6.0, 0)
    allobjs = roots + [o for e in roots for o in e.children_recursive]
    path = export_glb(OUT / 'props.glb', allobjs, skins=False)
    return path, {'props': PROPS}

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'assets': {}}
    jobs = [('anims', build_anims), ('props', build_props)]
    for kind, table, single in (('heroes', heroes(), False), ('enemies', enemies(), True), ('bosses', bosses(), False), ('tests', tests() if ONLY else {}, False)):
        for mid, d in table.items():
            jobs.append((mid, (lambda k=kind, m=mid, dd=d, s=single: export_char(k, m, dd, s))))
    import monsters
    for mid, fn in monsters.MONSTERS.items():
        jobs.append((mid, (lambda m=mid, f=fn: monsters.export_monster(m, f))))
    for mid, fn in jobs:
        if ONLY and mid not in ONLY: continue
        t0 = time.time()
        path, info = fn()
        rel = str(Path(path).relative_to(OUT))
        manifest['assets'][mid] = {'file': rel, 'bytes': Path(path).stat().st_size, 'sha256': sha(path), **info}
        print(f'BUILT {mid:22s} {Path(path).stat().st_size / 1024:8.1f} KB  {time.time() - t0:5.1f}s  {info.get("triangles", "")}')
    manifest['generated'] = time.strftime('%Y-%m-%dT%H:%M:%S')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')

main()
