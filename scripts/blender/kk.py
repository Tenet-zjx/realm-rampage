# Shared Blender helpers for the Realm Rampage asset pipeline (Blender 5.x, run headless).
# Conventions: Blender is Z-up and characters face -Y (glTF +Z). Vertex colour attribute "Col"
# (RGBA, linear) encodes the runtime material: a == 0 textured*rgb, 0 < a <= .5 flat rgb,
# a > .5 flat rgb + emissive glow of strength (a - .5) * 2.  See src/render/character-material.js.
import bpy, bmesh, json, math, struct, colorsys
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion, Euler
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art/source/kaykit'
OUT = ROOT / 'public/assets/models'
FLAT, GLOW = 0.4, 1.0

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30

def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if any(c.name == 'glTF_not_exported' for c in o.users_collection):
            bpy.data.objects.remove(o, do_unlink=True)
    return [o for o in bpy.data.objects if o not in before]

def armature_of(objs):
    return next(o for o in objs if o.type == 'ARMATURE')

def gltf_json(path):
    path = Path(path)
    if path.suffix == '.glb':
        b = path.read_bytes(); n = struct.unpack_from('<I', b, 12)[0]
        return json.loads(b[20:20 + n])
    return json.loads(path.read_text())

C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # glTF -> Blender axes

def _trs(n):
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    return Matrix.Translation(t) @ Quaternion((r[3], r[0], r[1], r[2])).to_matrix().to_4x4() @ Matrix.Diagonal((s[0], s[1], s[2], 1))

def node_world(j, name):
    parent = {}
    for i, n in enumerate(j['nodes']):
        for c in n.get('children', []): parent[c] = i
    idx = next(i for i, n in enumerate(j['nodes']) if n.get('name') == name)
    m = Matrix.Identity(4)
    while idx is not None:
        m = _trs(j['nodes'][idx]) @ m
        idx = parent.get(idx)
    return C @ m @ C.inverted()

# Local offsets KayKit uses for items under the hand slots (read from Knight.glb).
SLOT = {
    'r': ('handslot.r', Matrix.Translation((0, 0.0333, 0)) @ Quaternion((0, 0, 1, 0)).to_matrix().to_4x4()),
    'l': ('handslot.l', Matrix.Translation((0, 0.017, 0))),
    'shield': ('handslot.l', Matrix.Translation((0, 0.017, 0.1559))),
}

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def set_color(obj, rgba):
    if rgba[3] > 0: rgba = (*[srgb_to_linear(c) for c in rgba[:3]], rgba[3])
    me = obj.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    attr.data.foreach_set('color', list(rgba) * len(attr.data))
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.active_color_index

def ensure_uv(obj):
    if not obj.data.uv_layers: obj.data.uv_layers.new(name='UVMap')

def rigid_to_bone(obj, bone):
    mw = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = mw
    for vg in list(obj.vertex_groups): obj.vertex_groups.remove(vg)
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')

def attach_item(arm_src_json, path, slot):
    bone, local = SLOT[slot]
    objs = [o for o in import_gltf(path) if o.type == 'MESH']
    m = node_world(arm_src_json, bone) @ C @ local @ C.inverted()
    for o in objs:
        o.matrix_world = m @ o.matrix_world
        rigid_to_bone(o, bone)
    return objs

def join(objs, active):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    active.select_set(True)
    bpy.context.view_layer.objects.active = active
    if len(objs) > 1: bpy.ops.object.join()
    return active

def recolor(img, ops, name):
    """Copy img and apply colour ops; returns new packed image."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
    px = px.reshape(-1, 4); rgb = px[:, :3].copy()
    mx = rgb.max(1); mn = rgb.min(1); d = mx - mn + 1e-6
    hue = np.zeros_like(mx)
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    sat = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0); val = mx
    for op in ops:
        mask = np.ones_like(val, dtype=bool)
        if op.get('protect_skin'): mask &= ~((hue > 0.02) & (hue < 0.11) & (sat > 0.18) & (sat < 0.62) & (val > 0.45))
        if 'min_sat' in op: mask &= sat >= op['min_sat']
        if 'max_sat' in op: mask &= sat <= op['max_sat']
        if 'hue' in op: hue = np.where(mask, (hue + op['hue'] / 360.0) % 1.0, hue)
        if 'set_hue' in op: hue = np.where(mask, op['set_hue'] / 360.0, hue)
        if 'sat' in op: sat = np.where(mask, np.clip(sat * op['sat'] + op.get('sat_add', 0), 0, 1), sat)
        if 'val' in op: val = np.where(mask, np.clip(val * op['val'] + op.get('val_add', 0), 0, 1), val)
    i = np.floor(hue * 6).astype(int) % 6; f = hue * 6 - np.floor(hue * 6)
    p = val * (1 - sat); q = val * (1 - f * sat); t = val * (1 - (1 - f) * sat)
    out = np.stack([np.choose(i, [val, q, p, p, t, val]), np.choose(i, [t, val, val, q, p, p]), np.choose(i, [p, p, t, val, val, q])], 1)
    tint = [op for op in ops if 'tint' in op]
    for op in tint:
        tc = np.array(op['tint'], dtype=np.float32); a = op.get('amount', 0.5)
        lum = out.mean(1, keepdims=True)
        out = out * (1 - a) + (lum * 1.6 * tc) * a
    px[:, :3] = np.clip(out, 0, 1)
    new = bpy.data.images.new(name, w, h, alpha=True)
    new.pixels.foreach_set(px.ravel())
    new.pack()
    return new

def save_png(img, path):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    img.filepath_raw = str(path); img.file_format = 'PNG'; img.save()

def base_material(objs):
    for o in objs:
        for s in o.material_slots:
            if s.material and s.material.name not in ('Glow',) and s.material.node_tree and any(n.bl_idname == 'ShaderNodeTexImage' for n in s.material.node_tree.nodes):
                return s.material
    return None

def material_image(mat):
    return next(n.image for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeTexImage')

def flat_material(name='flat'):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return mat

# ---------- primitive builders (return mesh objects in world space) ----------
def _obj_from_bm(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    ensure_uv(o)
    return o

def _finish(o, color, alpha, bone, mat, smooth=True):
    set_color(o, (*color, alpha))
    if bone:
        vg = o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    if mat is not None:
        o.data.materials.clear(); o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = smooth
    return o

def ellipsoid(name, center, radii, color, alpha=FLAT, bone=None, mat=None, seg=12, rings=8, rot=(0, 0, 0), smooth=True):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Euler([math.radians(a) for a in rot]).to_matrix(), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), color, alpha, bone, mat, smooth)

def box(name, center, size, color, alpha=FLAT, bone=None, mat=None, rot=(0, 0, 0), bevel=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES')
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Euler([math.radians(a) for a in rot]).to_matrix(), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), color, alpha, bone, mat, False)

def cone(name, base, direction, radius, length, color, alpha=FLAT, bone=None, mat=None, seg=8, tip_radius=0.0, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=radius, radius2=tip_radius, depth=length)
    bmesh.ops.translate(bm, vec=Vector((0, 0, length / 2)), verts=bm.verts)
    d = Vector(direction).normalized(); q = Vector((0, 0, 1)).rotation_difference(d)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=q.to_matrix(), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(base), verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), color, alpha, bone, mat, smooth)

def cylinder(name, a, b, radius, color, alpha=FLAT, bone=None, mat=None, seg=8):
    a, b = Vector(a), Vector(b)
    return cone(name, a, b - a, radius, (b - a).length, color, alpha, bone, mat, seg, tip_radius=radius, smooth=True)

def tube(name, points, radii, color, alpha=FLAT, bone=None, mat=None, seg=8):
    """Tapered tube along a polyline (horns, tails, tendrils)."""
    bm = bmesh.new(); rings = []
    pts = [Vector(p) for p in points]
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        q = Vector((0, 0, 1)).rotation_difference(d)
        ring = [bm.verts.new(p + q @ Vector((math.cos(a) * radii[i], math.sin(a) * radii[i], 0))) for a in (2 * math.pi * k / seg for k in range(seg))]
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg): bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    bm.faces.new(list(reversed(rings[0])))
    tip = bm.verts.new(pts[-1] + (pts[-1] - pts[-2]).normalized() * radii[-1] * 2)
    for k in range(seg): bm.faces.new((rings[-1][k], rings[-1][(k + 1) % seg], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_obj_from_bm(bm, name), color, alpha, bone, mat, True)

def plate(name, points, normal_axis, thickness, color, alpha=FLAT, bone=None, mat=None):
    """Flat prism from a polygon given in world space (wing membranes, feathers, flags)."""
    bm = bmesh.new()
    off = Vector(normal_axis).normalized() * thickness / 2
    top = [bm.verts.new(Vector(p) + off) for p in points]
    bot = [bm.verts.new(Vector(p) - off) for p in points]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    n = len(points)
    for i in range(n):
        bm.faces.new((top[i], bot[i], bot[(i + 1) % n], top[(i + 1) % n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_obj_from_bm(bm, name), color, alpha, bone, mat, False)

def torus(name, center, major, minor, color, alpha=FLAT, bone=None, mat=None, seg=20, tseg=6, rot=(0, 0, 0)):
    bm = bmesh.new(); verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; ring = []
        for j in range(tseg):
            b = 2 * math.pi * j / tseg
            ring.append(bm.verts.new(((major + minor * math.cos(b)) * math.cos(a), (major + minor * math.cos(b)) * math.sin(a), minor * math.sin(b))))
        verts.append(ring)
    for i in range(seg):
        for j in range(tseg):
            bm.faces.new((verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % tseg], verts[i][(j + 1) % tseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Euler([math.radians(a) for a in rot]).to_matrix(), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return _finish(_obj_from_bm(bm, name), color, alpha, bone, mat, True)

# ---------- character measurements ----------
def bone_head(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local

def world_bbox(objs):
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

def head_info(meshes):
    head = [o for o in meshes if any(k in o.name for k in ('Head', 'Skull'))]
    tops = [o for o in meshes if any(k in o.name for k in ('Head', 'Skull', 'Helmet', 'Hat', 'Hood'))]
    mn, mx = world_bbox(head)
    _, tmx = world_bbox(tops)
    c = (mn + mx) / 2
    return {'center': c, 'radius': (mx.x - mn.x) / 2, 'top': tmx.z, 'front': mn.y}

# ---------- export ----------
def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

def export_glb(path, objs, animations=False, skins=True, meshopt=True, frame_step=1):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    select_only(objs)
    kw = dict(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
              export_animations=animations, export_skins=skins, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
              export_image_format='AUTO', export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=False,
              export_meshopt_compression_enable=meshopt)
    if animations:
        kw.update(export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=frame_step, export_optimize_animation_size=True, export_reset_pose_bones=True, export_anim_slide_to_zero=True)
    bpy.ops.export_scene.gltf(**kw)
    return path
