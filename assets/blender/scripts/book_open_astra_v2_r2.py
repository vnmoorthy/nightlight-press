import bpy
import math
import os
import random
from mathutils import Vector

# Headless:
# blender -b --factory-startup -P book_open.py --python-exit-code 1

random.seed(7)
OUTPUT_DIR = os.path.abspath(os.environ.get("OUTPUT_DIR", "./book_open_frames"))
RES_X = int(os.environ.get("RES_X", "1600"))
RES_Y = int(os.environ.get("RES_Y", "900"))
SAMPLES = int(os.environ.get("SAMPLES", "24"))
FRAME_LIST = os.environ.get("FRAME_LIST", "").strip()
os.makedirs(OUTPUT_DIR, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene

try:
    scene.render.engine = 'BLENDER_EEVEE'
except Exception:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'

try:
    scene.eevee.taa_render_samples = SAMPLES
except Exception:
    print("WARNING: legacy EEVEE sample property unavailable.", flush=True)
    try:
        scene.eevee.taa_samples = SAMPLES
    except Exception:
        pass

scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 200
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.use_file_extension = True
scene.render.film_transparent = False
scene.render.use_compositing = True
try:
    scene.render.use_motion_blur = False
except Exception:
    pass

for transform in ('AgX', 'Filmic', 'Standard'):
    try:
        scene.view_settings.view_transform = transform
        break
    except Exception:
        pass

for look in ('AgX - Medium High Contrast', 'AgX - Punchy', 'Medium High Contrast'):
    try:
        scene.view_settings.look = look
        break
    except Exception:
        pass

scene.view_settings.exposure = 0.55
scene.view_settings.gamma = 1.0

HEX = {
    'paper': 'FFF8EC', 'ink': '22223B', 'tomato': 'FF6B4A',
    'sun': 'FFC233', 'sky': '4DA8DA', 'leaf': '3BB273',
    'lilac': 'B8A1FF', 'wood1': 'CBA577', 'wood2': 'AB8059',
    'wood3': 'E0BD8C', 'wood4': 'C0966B', 'wood5': 'D8B58B',
    'cream': 'F5E6CC',
}


def linear_color(hex_string):
    h = HEX.get(hex_string, hex_string).lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045
                 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb)


def set_input(node, name, value):
    socket = node.inputs.get(name)
    if socket is not None:
        try:
            socket.default_value = value
        except Exception:
            pass


def material(name, color, emission=0.0, roughness=0.78, alpha=1.0):
    m = bpy.data.materials.new(name)
    # Avoid the deprecated setter when nodes already exist.
    if m.node_tree is None:
        m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    rgba = (*linear_color(color), 1.0)
    set_input(bsdf, 'Base Color', rgba)
    set_input(bsdf, 'Roughness', roughness)
    set_input(bsdf, 'Coat Weight', 0.025)
    set_input(bsdf, 'Sheen Weight', 0.08)
    set_input(bsdf, 'Emission Color', rgba)
    set_input(bsdf, 'Emission Strength', emission)
    set_input(bsdf, 'Alpha', alpha)
    m.diffuse_color = (*rgba[:3], alpha)
    if alpha < 1.0:
        try:
            m.surface_render_method = 'DITHERED'
        except Exception:
            try:
                m.blend_method = 'BLEND'
            except Exception:
                pass
        try:
            m.use_transparent_shadow = True
        except Exception:
            pass
    return m


M = {key: material(key, key, roughness=0.86 if 'wood' in key else 0.78)
     for key in HEX}

# A small warm bounce term keeps the deeply stacked paper from reading grey.
paper_bsdf = M['paper'].node_tree.nodes.get('Principled BSDF')
set_input(paper_bsdf, 'Emission Strength', 0.095)
M['emblem'] = material('Softly glowing sun emblem', 'sun', 0.65)
M['star_gold'] = material('Golden paper stars', 'sun', 2.3)
M['star_paper'] = material('Ivory paper stars', 'paper', 1.8)

spark_mats = [
    material('Spark warm white', 'FFF4D6', 13),
    material('Spark golden', 'FFD268', 11),
    material('Spark lilac', 'lilac', 8),
    material('Spark tomato', 'tomato', 7),
]


def finish(obj, name, mat=None, parent=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def bevel(obj, width=0.025, segments=3):
    mod = obj.modifiers.new('Soft rounded edges', 'BEVEL')
    mod.width = width
    mod.segments = segments
    try:
        mod.harden_normals = True
    except Exception:
        pass
    return obj


def box(name, loc, dims, mat, radius=0.025, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, name, mat, parent)
    if radius:
        bevel(obj, radius)
    return obj


def sphere(name, loc, scale, mat, parent=None, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    finish(obj, name, mat, parent)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def disc(name, loc, radius, depth, mat, parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    finish(obj, name, mat, parent)
    bevel(obj, min(depth * 0.28, 0.012), 3)
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = 0.15
    if parent:
        obj.parent = parent
    return obj


def extruded_polygon(name, points, thickness, mat, loc=(0, 0, 0),
                     parent=None, rounding=0.003):
    area = sum(points[i][0] * points[(i + 1) % len(points)][1]
               - points[(i + 1) % len(points)][0] * points[i][1]
               for i in range(len(points)))
    if area < 0:
        points = list(reversed(points))
    n = len(points)
    verts = [(x, y, -thickness / 2) for x, y in points]
    verts += [(x, y, thickness / 2) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n)
              for i in range(n)]
    mesh = bpy.data.meshes.new(name + ' mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = loc
    finish(obj, name, mat, parent)
    if rounding:
        bevel(obj, rounding, 2)
    return obj


def key(obj, path, value, frame):
    setattr(obj, path, value)
    obj.keyframe_insert(data_path=path, frame=frame)


# ---------------------------------------------------------------------------
# Rounded matte timber, cream background, and softly blurred clay props.
# ---------------------------------------------------------------------------
wood_sequence = ['wood3', 'wood1', 'wood5', 'wood2', 'wood3',
                 'wood4', 'wood5', 'wood1', 'wood3', 'wood4',
                 'wood2', 'wood5', 'wood1']
for i in range(13):
    y = -5.0 + i * 0.82
    box('Honey and oak tabletop plank %02d' % i, (0, y, -0.105),
        (18, 0.806, 0.21), M[wood_sequence[i]], 0.045)

box('Soft warm cream backdrop', (0, 3.30, 4.0),
    (25, 0.30, 10), M['cream'], 0.14)


def make_mug():
    cx, cy = -2.55, 1.95
    profile = [
        (0.0, 0.025), (0.26, 0.025), (0.33, 0.065),
        (0.35, 0.65), (0.335, 0.70), (0.29, 0.70),
        (0.275, 0.64), (0.255, 0.115), (0.0, 0.115),
    ]
    seg = 48
    verts = []
    for r, z in profile:
        for j in range(seg):
            a = math.tau * j / seg
            verts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    faces = []
    for ring in range(len(profile) - 1):
        for j in range(seg):
            k = (j + 1) % seg
            faces.append((ring * seg + j, ring * seg + k,
                          (ring + 1) * seg + k, (ring + 1) * seg + j))
    mesh = bpy.data.meshes.new('Lathed hollow mug mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Sky blue clay mug', mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(M['sky'])
    bevel(obj, 0.012, 3)
    for p in mesh.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_torus_add(
        major_segments=40, minor_segments=12,
        location=(cx - 0.35, cy, 0.38),
        rotation=(math.pi / 2, 0, 0),
        major_radius=0.20, minor_radius=0.070)
    handle = finish(bpy.context.object, 'Rounded mug handle', M['sky'])
    for p in handle.data.polygons:
        p.use_smooth = True


make_mug()
plant_x, plant_y = 2.48, 2.12
disc('Little plant pot', (plant_x, plant_y, 0.22),
     0.29, 0.44, M['wood2'])
disc('Pot rounded rim', (plant_x, plant_y, 0.44),
     0.31, 0.08, M['wood3'])
disc('Plant stem', (plant_x, plant_y, 0.67),
     0.045, 0.47, M['leaf'])
for i, (dx, dy, z) in enumerate([
    (-0.21, 0, 0.74), (0.20, 0.01, 0.85), (-0.11, 0.05, 1.02),
    (0.12, -0.04, 1.13), (0, 0, 1.28)
]):
    leaf = sphere('Clay plant leaf %d' % i,
                  (plant_x + dx, plant_y + dy, z),
                  (0.21, 0.115, 0.25), M['leaf'])
    leaf.rotation_euler.y = -0.55 if dx < 0 else 0.55

sphere('Lilac background ball', (0.48, 2.35, 0.26),
       (0.26, 0.26, 0.26), M['lilac'])

# ---------------------------------------------------------------------------
# Hardcover construction and opening hinge.
# ---------------------------------------------------------------------------
box('Tomato back board', (1, 0, 0.040),
    (2.04, 1.54, 0.040), M['tomato'], 0.025)
box('Lower half paper block', (1, 0, 0.130),
    (1.91, 1.405, 0.140), M['paper'], 0.015)

front = empty('Front half hinge at middle of book', (0, 0, 0.264))
box('Upper half paper block', (1, 0, 0.392 - 0.264),
    (1.91, 1.405, 0.140), M['paper'], 0.015, front)
cover = box('Front hardcover', (1, 0, 0.488 - 0.264),
            (2.04, 1.54, 0.040), M['tomato'], 0.025, front)

disc('Raised sun emblem', (0, 0.14, 0.026),
     0.205, 0.010, M['emblem'], cover)
for i in range(10):
    a = math.tau * i / 10
    ray = box('Sun emblem ray %02d' % i,
              (0.292 * math.cos(a), 0.14 + 0.292 * math.sin(a), 0.026),
              (0.105, 0.032, 0.010), M['emblem'], 0.012, cover)
    ray.rotation_euler.z = a
box('Paper title strip', (0, -0.355, 0.025),
    (1.24, 0.175, 0.008), M['paper'], 0.025, cover)

font = bpy.data.curves.new('Publisher lettering', 'FONT')
font.body = 'NIGHTLIGHT PRESS'
font.align_x = 'CENTER'
font.align_y = 'CENTER'
font.size = 0.092
font.space_character = 1.05
font.extrude = 0.0005
font.bevel_depth = 0.0002
text = bpy.data.objects.new('Nightlight Press title', font)
scene.collection.objects.link(text)
text.parent = cover
text.location = (0, -0.355, 0.030)
font.materials.append(M['ink'])

spine = box('Rounded flexible tomato spine', (0, 0, 0.264),
            (0.075, 1.54, 0.49), M['tomato'], 0.035)
for frame, height, center in [
    (1, 0.49, 0.264), (20, 0.49, 0.264),
    (70, 0.17, 0.112), (80, 0.15, 0.102)
]:
    key(spine, 'scale', (1, 1, height / 0.49), frame)
    key(spine, 'location', (0, 0, center), frame)

for frame, deg in [
    (1, 0), (20, 0), (62, -160), (70, -180),
    (75, -178.9), (82, -180), (200, -180)
]:
    key(front, 'rotation_euler', (0, math.radians(deg), 0), frame)

score_mat = material('Subtle warm page edge lines', 'EBDDC8', roughness=0.9)
for i in range(5):
    z = 0.085 + i * 0.022
    box('Lower page fore edge %d' % i, (1.956, 0, z),
        (0.0025, 1.32, 0.002), score_mat, 0.0008)
    box('Upper page fore edge %d' % i, (1.956, 0, z - 0.058),
        (0.0025, 1.32, 0.002), score_mat, 0.0008, front)

# ---------------------------------------------------------------------------
# Individually hinged pages, subdivided sufficiently for a visible soft curl.
# Curl is an analytic cylindrical shape key rather than a version-dependent
# Simple Deform setup. Negative local Z makes the free edge trail the turn.
# ---------------------------------------------------------------------------
page_hinges = []
page_objects = []
for i in range(6):
    z = 0.251 + (5 - i) * 0.009
    hinge = empty('Individual page hinge %02d' % (i + 1), (0, 0, z))
    page_hinges.append(hinge)
    verts, faces = [], []
    nx, ny = 64, 8
    for ix in range(nx + 1):
        x = 0.045 + 1.905 * ix / nx
        for iy in range(ny + 1):
            verts.append((x, -0.698 + 1.396 * iy / ny, 0))
    for ix in range(nx):
        for iy in range(ny):
            a = ix * (ny + 1) + iy
            faces.append((a, a + ny + 1, a + ny + 2, a + 1))
    mesh = bpy.data.meshes.new('Subdivided paper leaf %02d' % i)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    page = bpy.data.objects.new('Turning paper leaf %02d' % (i + 1), mesh)
    scene.collection.objects.link(page)
    page.parent = hinge
    page.data.materials.append(M['paper'])
    for p in mesh.polygons:
        p.use_smooth = True
    solid = page.modifiers.new('Six millimeter paper thickness', 'SOLIDIFY')
    solid.thickness = 0.006
    solid.offset = 0
    bevel(page, 0.002, 2)
    page_objects.append(page)

    start = 62 + 11 * i
    end_angle = -(176 - 3 * i)
    for f, deg in [
        (1, 0), (start, 0), (start + 8, -28),
        (start + 16, -102), (start + 30, end_angle), (200, end_angle)
    ]:
        key(hinge, 'rotation_euler', (0, math.radians(deg), 0), f)

# ---------------------------------------------------------------------------
# Thin raised paper-cut illustrations.
# ---------------------------------------------------------------------------
def cloud_outline():
    circles = [(-0.145, 0, 0.12), (0, 0.045, 0.16), (0.15, 0, 0.115)]
    outline = []
    for i in range(80):
        a = math.tau * i / 80
        dx, dy = math.cos(a), math.sin(a)
        distance = 0
        for cx, cy, r in circles:
            projection = cx * dx + cy * dy
            discriminant = r * r - cx * cx - cy * cy + projection * projection
            if discriminant >= 0:
                distance = max(distance, projection + math.sqrt(discriminant))
        outline.append((dx * distance, dy * distance))
    return outline


def star_points(radius, phase=math.pi / 2):
    return [
        ((radius if i % 2 == 0 else radius * 0.46)
         * math.cos(phase + i * math.pi / 5),
         (radius if i % 2 == 0 else radius * 0.46)
         * math.sin(phase + i * math.pi / 5))
        for i in range(10)
    ]


def illustration(name, parent, base_z, back=False):
    sign = -1 if back else 1

    def level(h):
        return base_z + sign * h

    points = [(0.12, -0.60), (1.87, -0.60)]
    for j in range(49):
        x = 1.87 - 1.75 * j / 48
        points.append((x, -0.16 + 0.19 * math.sin((x - 0.1) * 3.1)))
    extruded_polygon(name + ' broad green hill', points, 0.009,
                     M['leaf'], (0, 0, level(0.006)), parent)

    second = [(0.12, -0.60), (1.87, -0.60)]
    for j in range(49):
        x = 1.87 - 1.75 * j / 48
        second.append((x, -0.40 + 0.15 * math.sin(x * 3.6 + 0.7)))
    extruded_polygon(name + ' sunny foreground hill', second, 0.008,
                     material(name + ' light meadow', '79C98A'),
                     (0, 0, level(0.014)), parent)

    disc(name + ' cut-out sunshine', (0.40, 0.36, level(0.007)),
         0.145, 0.010, M['sun'], parent)
    extruded_polygon(name + ' three-lobed blue cloud', cloud_outline(),
                     0.010, M['sky'], (1.29, 0.35, level(0.007)), parent)
    extruded_polygon(name + ' little lilac star', star_points(0.105),
                     0.010, M['lilac'], (1.73, 0.41, level(0.007)), parent)
    box(name + ' tiny tomato house', (1.15, -0.22, level(0.018)),
        (0.285, 0.255, 0.010), M['tomato'], 0.009, parent)
    extruded_polygon(name + ' house wedge roof',
                     [(-0.19, 0), (0.19, 0), (0, 0.19)], 0.011,
                     M['sun'], (1.15, -0.105, level(0.019)), parent)
    box(name + ' little ivory door', (1.15, -0.27, level(0.026)),
        (0.067, 0.13, 0.005), M['paper'], 0.008, parent)
    disc(name + ' round sky window', (1.15, -0.065, level(0.027)),
         0.032, 0.005, M['sky'], parent, vertices=24)


illustration('Right revealed picture', None, 0.202)
illustration('Back of final leaf picture', page_hinges[-1], -0.004, back=True)

# Tessellate and subdivide the last leaf's cut-outs so they follow its curl.
# Operate on mesh data, leaving the existing bevel modifiers intact.
import bmesh

for obj in list(page_hinges[-1].children):
    if obj == page_objects[-1] or obj.type != 'MESH':
        continue
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    long_edges = [edge for edge in bm.edges if edge.calc_length() > 0.075]
    if long_edges:
        bmesh.ops.subdivide_edges(
            bm, edges=long_edges, cuts=12, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def add_page_curl(obj, start, angle_degrees=64.0):
    # obj is directly parented to its page hinge.
    obj.shape_key_add(name='Basis')
    curled = obj.shape_key_add(name='Trailing paper curl')
    transform = obj.matrix_basis.copy()
    inverse = transform.inverted()
    k = math.radians(angle_degrees) / 1.905
    for source, destination in zip(obj.data.vertices, curled.data):
        p = transform @ source.co
        u = max(0.0, p.x - 0.045)
        theta = k * u
        q = Vector((
            0.045 + math.sin(theta) / k + p.z * math.sin(theta),
            p.y,
            -(1.0 - math.cos(theta)) / k + p.z * math.cos(theta)
        ))
        if p.x < 0.045:
            q = p
        destination.co = inverse @ q

    for frame, amount in [
        (1, 0), (start, 0), (start + 8, 0.44),
        (start + 16, 1.0), (start + 23, 0.55),
        (start + 30, 0), (200, 0)
    ]:
        curled.value = amount
        curled.keyframe_insert(data_path='value', frame=frame)


bpy.context.view_layer.update()
for i, hinge in enumerate(page_hinges):
    start = 62 + 11 * i
    for child in list(hinge.children):
        if child.type == 'MESH':
            add_page_curl(child, start, 62.0 + (i % 3) * 3.0)

# ---------------------------------------------------------------------------
# Clearly visible golden gutter light with soft procedural falloff.
# ---------------------------------------------------------------------------
def light(name, light_type, loc, color, energy):
    data = bpy.data.lights.new(name, light_type)
    data.color = linear_color(color)
    data.energy = energy
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    return obj


magic = light('Golden light emerging from gutter', 'POINT',
              (0, -0.02, 0.62), 'FFD17C', 0)
magic.data.shadow_soft_size = 0.48
for f, power in [
    (1, 0), (59, 0), (73, 15), (85, 48), (105, 66), (120, 78),
    (133, 69), (146, 81), (159, 72), (172, 80), (186, 72), (200, 78)
]:
    key(magic.data, 'energy', power, f)


def glow_material(name, maximum_alpha):
    m = material(name, 'FFD16D', 0.0, roughness=1, alpha=maximum_alpha)
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexCoord')
    subtract = nodes.new('ShaderNodeVectorMath')
    subtract.operation = 'SUBTRACT'
    subtract.inputs[1].default_value = (0.5, 0.5, 0)
    length = nodes.new('ShaderNodeVectorMath')
    length.operation = 'LENGTH'
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE'
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (maximum_alpha,) * 3 + (1,)
    ramp.color_ramp.elements[1].position = 0.49
    ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
    mid = ramp.color_ramp.elements.new(0.22)
    mid.color = (maximum_alpha * 0.45,) * 3 + (1,)
    links.new(tex.outputs['UV'], subtract.inputs[0])
    links.new(subtract.outputs['Vector'], length.inputs[0])
    links.new(length.outputs['Value'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Alpha'])
    return m


for i, (width, depth, z, alpha, strength) in enumerate([
    (0.52, 1.38, 0.326, 0.37, 5.5),
    (0.76, 1.46, 0.395, 0.20, 4.7),
    (0.98, 1.52, 0.490, 0.12, 4.0),
    (1.18, 1.60, 0.610, 0.065, 3.5),
]):
    mat = glow_material('Soft radial gutter glow layer %d' % i, alpha)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, z))
    obj = finish(bpy.context.object, 'Feathered golden glow plane %d' % i, mat)
    base_scale = (width, depth, 1)
    for f, s in [(1, (0, 0, 0)), (59, (0, 0, 0)),
                 (85, base_scale), (200, base_scale)]:
        key(obj, 'scale', s, f)
    socket = mat.node_tree.nodes.get('Principled BSDF').inputs.get('Emission Strength')
    if socket:
        for f, value in [
            (1, 0), (59, 0), (75, strength * 0.35),
            (85, strength * 0.75), (120, strength),
            (147, strength * 0.88), (173, strength * 1.05), (200, strength)
        ]:
            socket.default_value = value
            socket.keyframe_insert(data_path='default_value', frame=f)

# ---------------------------------------------------------------------------
# Ninety glowing motes and eighteen readable paper stars.
# Stagger births through frame 198; late-born objects remain alive beyond 200.
# ---------------------------------------------------------------------------
bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=1)
template = bpy.context.object
spark_mesh = template.data
spark_mesh.name = 'Shared low-poly rounded sparkle mesh'
for p in spark_mesh.polygons:
    p.use_smooth = True
bpy.data.objects.remove(template, do_unlink=True)

spark_meshes = []
for index, mat in enumerate(spark_mats):
    mesh = spark_mesh.copy()
    mesh.name = 'Spark geometry material %d' % index
    mesh.materials.clear()
    mesh.materials.append(mat)
    spark_meshes.append(mesh)


def animate_rising(obj, birth, life, base_scale, is_star=False):
    x0 = random.triangular(-0.85, 0.85, 0)
    y0 = random.uniform(-0.38, 0.38)
    z0 = random.uniform(0.42, 0.60)
    rise = random.uniform(0.85, 1.95)
    drift_x = random.uniform(-0.43, 0.43)
    drift_y = random.uniform(-0.18, 0.20)
    amplitude = random.uniform(0.055, 0.17)
    phase = random.uniform(0, math.tau)
    # Stars begin tipped toward the camera, showing their five-point silhouettes.
    spin0 = (random.uniform(0.55, 1.0),
             random.uniform(-0.35, 0.35),
             random.uniform(-math.pi, math.pi))
    spin_delta = (random.uniform(-0.45, 0.45),
                  random.uniform(-0.65, 0.65),
                  random.uniform(-2.4, 2.4))
    death = birth + life

    key(obj, 'scale', (0, 0, 0), 1)
    key(obj, 'scale', (0, 0, 0), birth - 1)
    key(obj, 'scale', (0, 0, 0), birth)
    key(obj, 'scale', base_scale, birth + 5)
    key(obj, 'scale', base_scale, death - 12)
    key(obj, 'scale', (0, 0, 0), death)
    if death < 200:
        key(obj, 'scale', (0, 0, 0), 200)

    for f in list(range(birth, death, 8)) + [death]:
        t = (f - birth) / life
        wobble = amplitude * (math.sin(phase + t * math.tau) - math.sin(phase))
        key(obj, 'location',
            (x0 + drift_x * t + wobble,
             y0 + drift_y * t + 0.055 * math.sin(t * math.tau),
             z0 + rise * t), f)
        if is_star:
            key(obj, 'rotation_euler',
                tuple(spin0[k] + t * spin_delta[k] for k in range(3)), f)


for i in range(90):
    index = random.choices([0, 1, 2, 3], weights=[47, 38, 10, 5])[0]
    obj = bpy.data.objects.new('Rising sparkle %03d' % i, spark_meshes[index])
    scene.collection.objects.link(obj)
    radius = random.uniform(0.017, 0.035)
    birth = max(70, min(198, round(70 + i * 128 / 89 + random.uniform(-2, 2))))
    animate_rising(obj, birth, random.randint(64, 90), (radius,) * 3)

for i in range(18):
    # Broad, readable star silhouettes, with larger hero stars mixed in.
    radius = random.uniform(0.070, 0.105)
    obj = extruded_polygon(
        'Floating five-point paper star %02d' % i,
        star_points(radius), 0.012,
        M['star_paper' if i % 3 == 0 else 'star_gold'], rounding=0.003)
    birth = max(72, min(195, round(73 + i * 120 / 17 + random.uniform(-2, 2))))
    animate_rising(obj, birth, random.randint(72, 90), (1, 1, 1), True)

# ---------------------------------------------------------------------------
# Bright storybook morning lighting.
# ---------------------------------------------------------------------------
world = bpy.data.worlds.new('Warm cream ambient world')
scene.world = world
if world.node_tree is None:
    world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (*linear_color('FFF0DB'), 1)
background.inputs['Strength'].default_value = 0.60

sun = light('Sunny upper-left window sunlight', 'SUN',
            (-4, 3, 7), 'FFF0D8', 3.5)
sun.rotation_euler = Vector((0.65, -0.38, -1.0)).to_track_quat('-Z', 'Y').to_euler()
sun.data.angle = 0.18


def aim_at(obj, point):
    obj.rotation_euler = (
        Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


keylight = light('Large soft warm front-right key', 'AREA',
                 (3.5, -4.0, 6.0), 'FFF3E1', 650)
keylight.data.shape = 'DISK'
keylight.data.size = 5.0
aim_at(keylight, (0, 0, 0.2))

fill = light('Broad warm-neutral left fill', 'AREA',
             (-4, -1.3, 3.8), 'F5F1E9', 370)
fill.data.shape = 'DISK'
fill.data.size = 4.5
aim_at(fill, (0, 0, 0.35))

# ---------------------------------------------------------------------------
# Slightly lower camera angle exposes a hint of cream backdrop above the props.
# The lowered/forward final target raises the spread within the image.
# ---------------------------------------------------------------------------
target = empty('Camera focus and framing target', (1, 0, 0.22))
key(target, 'location', (1, 0, 0.22), 1)
key(target, 'location', (0, -0.14, 0.16), 200)

camera_data = bpy.data.cameras.new('50mm storybook camera')
camera = bpy.data.objects.new('Camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.lens = 50
camera_data.sensor_width = 36
camera_data.clip_start = 0.05
camera_data.clip_end = 150
camera_data.dof.use_dof = True
camera_data.dof.focus_object = target
camera_data.dof.aperture_fstop = 2.0
camera_data.dof.aperture_blades = 7

track = camera.constraints.new('TRACK_TO')
track.target = target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'
key(camera, 'location', (4.08, -8.35, 6.72), 1)
key(camera, 'location', (2.25, -6.10, 4.90), 200)

# Bezier keys with clamped handles, supporting both legacy and layered Actions.
def smooth_action(id_block):
    try:
        action = id_block.animation_data.action
    except Exception:
        return
    if not action:
        return
    curves = []
    try:
        curves.extend(action.fcurves)
    except Exception:
        pass
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves.extend(bag.fcurves)
    except Exception:
        pass
    for curve in curves:
        for point in curve.keyframe_points:
            point.interpolation = 'BEZIER'
            point.handle_left_type = 'AUTO_CLAMPED'
            point.handle_right_type = 'AUTO_CLAMPED'


for obj in scene.objects:
    smooth_action(obj)
    if obj.data:
        smooth_action(obj.data)
        if obj.type == 'MESH' and obj.data.shape_keys:
            smooth_action(obj.data.shape_keys)
for mat in bpy.data.materials:
    if mat.node_tree:
        smooth_action(mat.node_tree)

# ---------------------------------------------------------------------------
# Blender 5 compositor node group: soft, more visible bloom.
# ---------------------------------------------------------------------------
try:
    tree = bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
    tree.interface.new_socket(
        name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    scene.compositing_node_group = tree

    layers = tree.nodes.new('CompositorNodeRLayers')
    layers.location = (-320, 0)
    try:
        layers.scene = scene
    except Exception:
        pass
    glare = tree.nodes.new('CompositorNodeGlare')
    glare.location = (-80, 0)
    output = tree.nodes.new('NodeGroupOutput')
    output.location = (200, 0)
    try:
        output.is_active_output = True
    except Exception:
        pass

    def glare_setting(socket_names, attribute, value):
        for name in socket_names:
            socket = glare.inputs.get(name)
            if socket is not None:
                try:
                    socket.default_value = value
                    return True
                except Exception:
                    pass
        if hasattr(glare, attribute):
            try:
                setattr(glare, attribute, value)
                return True
            except Exception:
                pass
        return False

    if not glare_setting(['Type', 'Glare Type'], 'glare_type', 'BLOOM'):
        glare_setting(['Type', 'Glare Type'], 'glare_type', 'FOG_GLOW')
    glare_setting(['Quality'], 'quality', 'MEDIUM')
    glare_setting(['Threshold'], 'threshold', 1.0)
    glare_setting(['Strength'], 'strength', 0.52)
    glare_setting(['Mix'], 'mix', -0.35)

    size_socket = glare.inputs.get('Size')
    if size_socket is not None:
        try:
            size_socket.default_value = 0.38
        except Exception:
            pass
    else:
        try:
            glare.size = 8
        except Exception:
            pass

    tree.links.new(layers.outputs['Image'], glare.inputs['Image'])
    tree.links.new(glare.outputs['Image'], output.inputs['Image'])
    scene.render.use_compositing = True
except Exception as exc:
    print("WARNING: compositor setup skipped:", exc, flush=True)
    scene.render.use_compositing = False
    try:
        scene.compositing_node_group = None
    except Exception:
        pass

assert len(scene.objects) < 300, "Unexpectedly high object count"
print("book_open: built %d objects; rendering to %s" %
      (len(scene.objects), OUTPUT_DIR), flush=True)


def rendered_frame(scene_arg, *args):
    print("book_open: rendered frame %04d" % scene_arg.frame_current, flush=True)


bpy.app.handlers.render_write.append(rendered_frame)
scene.frame_set(1)

if FRAME_LIST:
    frames = [int(item.strip()) for item in FRAME_LIST.split(',') if item.strip()]
    for frame in frames:
        if not 1 <= frame <= 200:
            raise ValueError("FRAME_LIST frames must be between 1 and 200")
        scene.frame_set(frame)
        scene.render.filepath = os.path.join(OUTPUT_DIR, "frame_%04d.png" % frame)
        bpy.ops.render.render(write_still=True)
else:
    scene.render.filepath = os.path.join(OUTPUT_DIR, "frame_")
    bpy.ops.render.render(animation=True)

print("DONE", flush=True)
