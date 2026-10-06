class_name BattleMapView
extends Control
## Draws the mission as a printed military map: paper-coloured land with contour
## lines, textured forests, cased roads and a coordinate grid, with units shown as
## NATO-style symbols. Enemy units themselves are never read here, only Battle.contacts.

signal map_clicked(position: Vector2, button: MouseButton)

const CELL := 16.0

const COLOR_LAND := Color("ece5cf")
const COLOR_HIGH := Color("d2b98a")
const COLOR_CONTOUR := Color("a9743c")
const COLOR_WATER := Color("a8cfe6")
const COLOR_BANK := Color("3f7fb0")
const COLOR_FOREST_LIGHT := Color("a9c98c")
const COLOR_FOREST_DARK := Color("7fa867")
const COLOR_FOREST_EDGE := Color("55803f")
const COLOR_TOWN := Color("e6d3c2")
const COLOR_HOUSE := Color("9c4a36")
const COLOR_ROAD := Color("fbf7ea")
const COLOR_ROAD_CASING := Color("4a4338")
const COLOR_INK := Color("1c1c1c")
const COLOR_GRID := Color(0.1, 0.1, 0.1, 0.22)
const COLOR_PAPER := Color("f3eedd")

## Frame fills as on a NATO situation map: friendly blue, hostile red, unknown yellow.
const COLOR_FRIEND := Color("80c8ff")
const COLOR_FRIEND_LINE := Color("0b3c8c")
const COLOR_HOSTILE := Color("ff8a80")
const COLOR_HOSTILE_LINE := Color("b3141c")
const COLOR_UNKNOWN := Color("fff27a")
const COLOR_STRIKE := Color("1c1c1c")

const FRAME := Vector2(30, 20)
const PICK_RADIUS := 18.0
const ROAD_WIDTH := 4.0

## Terrain is drawn by the GPU from a tiny mask, one texel per cell: red is water,
## green forest, blue height, alpha town. Noise bends the sampling so edges look
## drawn by hand, and contour lines are cut from the height.
const GROUND_SHADER := "
shader_type canvas_item;
uniform sampler2D mask : filter_linear, repeat_disable;
uniform vec2 cells;
uniform vec3 land : source_color;
uniform vec3 high : source_color;
uniform vec3 contour : source_color;
uniform vec3 water : source_color;
uniform vec3 bank : source_color;
uniform vec3 forest_light : source_color;
uniform vec3 forest_dark : source_color;
uniform vec3 forest_edge : source_color;
uniform vec3 town : source_color;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
			mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// 1 on the line where value crosses level, 0 away from it; width in pixels.
float outline(float value, float level, float width) {
	float distance_px = abs(value - level) / max(fwidth(value), 0.0001);
	return 1.0 - smoothstep(width - 0.5, width + 0.5, distance_px);
}

void fragment() {
	vec2 p = UV * cells;
	vec2 bend = vec2(noise(p * 1.1 + 7.0), noise(p * 1.1 + 31.0)) - 0.5;
	vec2 fine = vec2(noise(p * 3.7 + 3.0), noise(p * 3.7 + 17.0)) - 0.5;
	vec4 soft = texture(mask, (p + bend * 0.7) / cells);
	float wood = texture(mask, (p + bend * 1.3 + fine * 0.5) / cells).g;

	float height = soft.b;
	vec3 color = mix(land, high, smoothstep(0.03, 0.8, height) * 0.6);
	color = mix(color, town, smoothstep(0.4, 0.6, soft.a) * 0.75);

	float level = height * 9.0;
	float ring = abs(fract(level - 0.5) - 0.5) / max(fwidth(level), 0.0001);
	float on_slope = step(0.05, height);
	color = mix(color, contour, (1.0 - smoothstep(0.4, 1.2, ring)) * on_slope * 0.75);

	float in_wood = smoothstep(0.47, 0.53, wood);
	float canopy = noise(p * 6.0) * 0.6 + noise(p * 17.0) * 0.4;
	color = mix(color, mix(forest_dark, forest_light, canopy), in_wood * 0.92);
	color = mix(color, forest_edge, outline(wood, 0.5, 0.9) * 0.8);

	float wet = soft.r;
	color = mix(color, water, smoothstep(0.47, 0.53, wet));
	color = mix(color, bank, outline(wet, 0.5, 1.0));

	color *= 0.965 + 0.05 * noise(p * 21.0);
	COLOR = vec4(color, 1.0);
}
"

var battle: Battle
var selected_unit := -1
## While true the cursor shows where an artillery strike would land.
var strike_mode := false

var _ground: ColorRect
var _font: Font
## Small rectangles of houses, in pixels, scattered over town cells once per mission.
var _houses: Array[Rect2] = []


func _ready() -> void:
	_font = get_theme_default_font()
	mouse_filter = Control.MOUSE_FILTER_STOP
	_ground = ColorRect.new()
	_ground.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ground.show_behind_parent = true
	var shader := Shader.new()
	shader.code = GROUND_SHADER
	var ground := ShaderMaterial.new()
	ground.shader = shader
	ground.set_shader_parameter("land", COLOR_LAND)
	ground.set_shader_parameter("high", COLOR_HIGH)
	ground.set_shader_parameter("contour", COLOR_CONTOUR)
	ground.set_shader_parameter("water", COLOR_WATER)
	ground.set_shader_parameter("bank", COLOR_BANK)
	ground.set_shader_parameter("forest_light", COLOR_FOREST_LIGHT)
	ground.set_shader_parameter("forest_dark", COLOR_FOREST_DARK)
	ground.set_shader_parameter("forest_edge", COLOR_FOREST_EDGE)
	ground.set_shader_parameter("town", COLOR_TOWN)
	_ground.material = ground
	add_child(_ground)


func set_battle(new_battle: Battle) -> void:
	battle = new_battle
	custom_minimum_size = Vector2(battle.map.size) * CELL
	_ground.size = custom_minimum_size
	var ground := _ground.material as ShaderMaterial
	ground.set_shader_parameter("mask", ImageTexture.create_from_image(_terrain_mask()))
	ground.set_shader_parameter("cells", Vector2(battle.map.size))
	_scatter_houses()
	queue_redraw()


func to_map(point: Vector2) -> Vector2:
	return point / CELL


func to_screen(position: Vector2) -> Vector2:
	return position * CELL


## Where the unit is shown, in map coordinates. Units standing together are spread
## sideways so every symbol and call sign stays readable and clickable.
func shown_position(unit: BattleUnit) -> Vector2:
	var shift := 0
	for other in battle.units:
		if other.id >= unit.id:
			break
		if other.side == unit.side and other.is_on_map() and other.position.distance_to(unit.position) < 1.2:
			shift += 1
	return unit.position + Vector2(shift * (FRAME.x + 10.0) / CELL, 0.0)


## Player unit under the point, or -1.
func unit_at(position: Vector2) -> int:
	var best := -1
	var best_distance := PICK_RADIUS / CELL
	for unit in battle.units:
		if unit.side != BattleUnit.Side.PLAYER or not unit.is_on_map():
			continue
		var distance := shown_position(unit).distance_to(position)
		if distance <= best_distance:
			best_distance = distance
			best = unit.id
	return best


## Objective whose capture circle contains the point, or -1.
func objective_at(position: Vector2) -> int:
	for objective in battle.map.objectives:
		if BattleMap.cell_centre(objective.cell).distance_to(position) <= battle.rules.capture_radius:
			return objective.index
	return -1


func _gui_input(event: InputEvent) -> void:
	if battle == null:
		return
	if event is InputEventMouseButton:
		var click := event as InputEventMouseButton
		if click.pressed and click.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT]:
			map_clicked.emit(to_map(click.position), click.button_index)
			accept_event()
	elif event is InputEventMouseMotion and strike_mode:
		queue_redraw()


func _draw() -> void:
	if battle == null:
		return
	for house in _houses:
		draw_rect(house, COLOR_HOUSE)
	_draw_roads()
	_draw_grid()
	for objective in battle.map.objectives:
		_draw_objective(objective)
	for unit in battle.units:
		if unit.side == BattleUnit.Side.PLAYER and unit.is_on_map():
			_draw_route(unit)
	for strike in battle.strikes:
		_draw_strike(strike)
	_draw_impacts()
	for contact: Battle.Contact in battle.contacts.values():
		_draw_contact(contact)
	for unit in battle.units:
		if unit.side == BattleUnit.Side.PLAYER and unit.is_on_map():
			_draw_fire(unit)
	for unit in battle.units:
		if unit.side == BattleUnit.Side.PLAYER and unit.is_on_map():
			_draw_unit(unit)
	if strike_mode:
		_draw_strike_cursor()


# --- Terrain ----------------------------------------------------------------

func _terrain_mask() -> Image:
	var map := battle.map
	var depth := _hill_depth()
	var image := Image.create(map.size.x, map.size.y, false, Image.FORMAT_RGBA8)
	for y in map.size.y:
		for x in map.size.x:
			var type := map.get_terrain(Vector2i(x, y))
			var water := type == Terrain.Type.WATER or type == Terrain.Type.BRIDGE
			# Height is the hill depth averaged with its neighbours, so slopes are even
			# and the contour lines cut from it are evenly spaced.
			var height := 0.0
			for dy in range(-1, 2):
				for dx in range(-1, 2):
					var at := Vector2i(clampi(x + dx, 0, map.size.x - 1), clampi(y + dy, 0, map.size.y - 1))
					height += depth[at.y * map.size.x + at.x]
			image.set_pixel(x, y, Color(
				1.0 if water else 0.0,
				1.0 if type == Terrain.Type.FOREST else 0.0,
				minf(height / 9.0 * 0.3, 1.0),
				1.0 if type == Terrain.Type.TOWN else 0.0
			))
	return image


## For every cell: 0 off a hill, otherwise how many cells deep inside the hill it lies.
func _hill_depth() -> PackedInt32Array:
	var map := battle.map
	var depth := PackedInt32Array()
	depth.resize(map.size.x * map.size.y)
	for level in range(1, 5):
		var changed := false
		for y in map.size.y:
			for x in map.size.x:
				var at := Vector2i(x, y)
				if map.get_terrain(at) != Terrain.Type.HILL or depth[y * map.size.x + x] != level - 1:
					continue
				var inside := level == 1
				if not inside:
					inside = true
					for step: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
						var next := at + step
						if not map.contains(next) or depth[next.y * map.size.x + next.x] < level - 1:
							inside = false
				if inside:
					depth[y * map.size.x + x] = level
					changed = true
		if not changed:
			break
	return depth


func _scatter_houses() -> void:
	_houses.clear()
	var random := RandomNumberGenerator.new()
	random.seed = 20261007
	var map := battle.map
	for y in map.size.y:
		for x in map.size.x:
			if map.get_terrain(Vector2i(x, y)) != Terrain.Type.TOWN:
				continue
			var origin := Vector2(x, y) * CELL
			for i in random.randi_range(2, 3):
				var house_size := Vector2(random.randi_range(3, 5), random.randi_range(3, 5))
				var at := origin + Vector2(random.randf_range(1.0, CELL - 6.0), random.randf_range(1.0, CELL - 6.0))
				_houses.append(Rect2(at.round(), house_size))


## Roads the way a printed map shows them: a pale line inside a dark casing.
func _draw_roads() -> void:
	var lines: Array[PackedVector2Array] = []
	for road in battle.map.roads:
		var points := PackedVector2Array()
		for point in road:
			points.append(to_screen(point))
		lines.append(points)
	for points in lines:
		draw_polyline(points, COLOR_ROAD_CASING, ROAD_WIDTH + 2.5, true)
		for point in points:
			draw_circle(point, (ROAD_WIDTH + 2.5) / 2.0, COLOR_ROAD_CASING)
	for points in lines:
		draw_polyline(points, COLOR_ROAD, ROAD_WIDTH, true)
		for point in points:
			draw_circle(point, ROAD_WIDTH / 2.0, COLOR_ROAD)


func _draw_grid() -> void:
	var square := BattleMap.SQUARE_CELLS * CELL
	var columns := ceili(battle.map.size.x / float(BattleMap.SQUARE_CELLS))
	var rows := ceili(battle.map.size.y / float(BattleMap.SQUARE_CELLS))
	for column in range(1, columns):
		draw_line(Vector2(column * square, 0), Vector2(column * square, size.y), COLOR_GRID, 1.0)
	for row in range(1, rows):
		draw_line(Vector2(0, row * square), Vector2(size.x, row * square), COLOR_GRID, 1.0)
	for column in columns:
		_text(Vector2(column * square + square / 2.0, 13), BattleMap.SQUARE_LETTERS[column], 12, Color(COLOR_INK, 0.7))
	for row in rows:
		_text(Vector2(9, row * square + square / 2.0 + 4.0), str(row + 1), 12, Color(COLOR_INK, 0.7))


# --- Objectives -------------------------------------------------------------

## An objective as a tactical graphic: a closed line in the colour of whoever holds it.
func _draw_objective(objective: BattleMap.Objective) -> void:
	var centre := to_screen(BattleMap.cell_centre(objective.cell))
	var radius := battle.rules.capture_radius * CELL
	var owner := battle.owners[objective.index]
	var color := COLOR_INK
	if owner == BattleUnit.Side.PLAYER:
		color = COLOR_FRIEND_LINE
	elif owner == BattleUnit.Side.ENEMY:
		color = COLOR_HOSTILE_LINE
	draw_circle(centre, radius, Color(color, 0.07))
	draw_arc(centre, radius, 0.0, TAU, 64, color, 2.5, true)

	var progress := battle.capture_progress[objective.index]
	if progress > 0.0:
		var taker := COLOR_FRIEND_LINE if battle.capture_side[objective.index] == BattleUnit.Side.PLAYER else COLOR_HOSTILE_LINE
		draw_arc(centre, radius + 5.0, -PI / 2.0, -PI / 2.0 + TAU * progress, 64, taker, 4.0, true)
	_text(centre + Vector2(0, -radius - 7.0), "ОБ. " + objective.title.to_upper(), 13, color)


# --- Units ------------------------------------------------------------------

func _draw_unit(unit: BattleUnit) -> void:
	var centre := to_screen(shown_position(unit))
	var frame := Rect2(centre - FRAME / 2.0, FRAME)
	if battle.time - unit.hit_at < 0.8:
		var beat := 0.5 + 0.5 * sin(battle.time * 14.0)
		draw_rect(frame.grow(5.0 + beat * 2.0), COLOR_HOSTILE_LINE, false, 2.5)
	if unit.id == selected_unit:
		draw_rect(frame.grow(4.0), COLOR_PAPER)
		draw_rect(frame.grow(4.0), COLOR_INK, false, 1.5)

	draw_rect(frame, COLOR_FRIEND)
	draw_rect(frame, COLOR_INK, false, 2.0)
	# A carrier with a squad aboard is shown as mechanised infantry.
	_draw_branch(int(unit.kind), frame, COLOR_INK, unit.passenger >= 0)

	# Size mark above the frame: one dot for a team, two for a section.
	var dots := 2 if unit.kind == UnitKind.Type.RIFLE else 1
	for i in dots:
		draw_circle(Vector2(centre.x + (i - (dots - 1) / 2.0) * 7.0, frame.position.y - 5.0), 2.2, COLOR_INK)

	# Strength bar under the frame.
	var share := float(unit.strength) / unit.max_strength()
	var bar := Rect2(Vector2(frame.position.x, frame.end.y + 3.0), Vector2(FRAME.x, 4.0))
	var bar_color := Color("2e8b3d")
	if share <= 0.3:
		bar_color = COLOR_HOSTILE_LINE
	elif share <= 0.6:
		bar_color = Color("c98a12")
	draw_rect(bar, COLOR_PAPER)
	draw_rect(Rect2(bar.position, Vector2(bar.size.x * share, bar.size.y)), bar_color)
	draw_rect(bar, COLOR_INK, false, 1.0)

	var title := unit.call_sign
	if unit.passenger >= 0:
		title += " + " + battle.units[unit.passenger].call_sign
	_text(centre + Vector2(0, FRAME.y / 2.0 + 21.0), title, 12, COLOR_FRIEND_LINE)


## Branch mark inside a frame: crossed lines for infantry, one slash for
## reconnaissance, an oval for armour.
func _draw_branch(kind: int, frame: Rect2, color: Color, with_infantry: bool = false) -> void:
	var centre := frame.get_center()
	if kind == UnitKind.Type.RIFLE or with_infantry:
		draw_line(frame.position, frame.end, color, 1.5, true)
		draw_line(Vector2(frame.position.x, frame.end.y), Vector2(frame.end.x, frame.position.y), color, 1.5, true)
	if kind == UnitKind.Type.SCOUT:
		draw_line(Vector2(frame.position.x, frame.end.y), Vector2(frame.end.x, frame.position.y), color, 1.5, true)
	if kind == UnitKind.Type.APC:
		draw_set_transform(centre, 0.0, Vector2(1.0, 0.5))
		draw_arc(Vector2.ZERO, frame.size.x * 0.33, 0.0, TAU, 28, color, 3.0, true)
		draw_set_transform(Vector2.ZERO)


func _draw_fire(unit: BattleUnit) -> void:
	if unit.target < 0 or not battle.contacts.has(unit.target):
		return
	# Tracers flicker instead of drawing a steady line.
	if int(battle.time * 10.0) % 3 == 0:
		return
	var from := to_screen(shown_position(unit))
	var to := to_screen(battle.contacts[unit.target].position)
	draw_dashed_line(from, to, Color(COLOR_INK, 0.7), 1.5, 5.0)


## Where a unit is going: an arrow in friendly blue, bold for the selected unit.
func _draw_route(unit: BattleUnit) -> void:
	if not unit.is_moving():
		return
	var points := PackedVector2Array([to_screen(unit.position)])
	for i in range(unit.path_index, unit.path.size()):
		points.append(to_screen(unit.path[i]))
	if points.size() < 2:
		return
	var selected := unit.id == selected_unit
	var color := COLOR_FRIEND_LINE if selected else Color(COLOR_FRIEND_LINE, 0.45)
	var width := 3.0 if selected else 2.0
	draw_polyline(points, color, width, true)
	var end := points[points.size() - 1]
	var back := (points[points.size() - 2] - end).normalized()
	var side := back.orthogonal()
	draw_colored_polygon(PackedVector2Array([
		end - back * 4.0, end + back * 9.0 + side * 6.0, end + back * 9.0 - side * 6.0,
	]), color)


# --- Enemy contacts ---------------------------------------------------------

## Identified contacts are red diamonds with a branch mark; unidentified ones are
## yellow circles with a question mark. Old contacts fade.
func _draw_contact(contact: Battle.Contact) -> void:
	var centre := to_screen(contact.position)
	var age := battle.time - contact.last_seen
	var alpha := 1.0
	if not contact.visible:
		alpha = lerpf(0.65, 0.2, clampf(age / battle.rules.contact_fade, 0.0, 1.0))
	var ink := Color(COLOR_INK, alpha)
	if contact.error > 0.8:
		draw_arc(centre, contact.error * CELL, 0.0, TAU, 40, Color(COLOR_HOSTILE_LINE, 0.55 * alpha), 1.5, true)

	if contact.kind < 0:
		draw_circle(centre, 11.0, Color(COLOR_UNKNOWN, alpha), true, -1.0, true)
		draw_arc(centre, 11.0, 0.0, TAU, 32, ink, 2.0, true)
		draw_string(_font, centre + Vector2(-10, 5), "?", HORIZONTAL_ALIGNMENT_CENTER, 20, 14, ink)
	else:
		var reach := 14.0
		var diamond := PackedVector2Array([
			centre + Vector2(0, -reach), centre + Vector2(reach, 0),
			centre + Vector2(0, reach), centre + Vector2(-reach, 0),
		])
		draw_colored_polygon(diamond, Color(COLOR_HOSTILE, alpha))
		diamond.append(diamond[0])
		draw_polyline(diamond, ink, 2.0, true)
		# The branch mark sits in the square inscribed in the diamond.
		var inner := Rect2(centre - Vector2(7, 7), Vector2(14, 14))
		_draw_branch(contact.kind, inner, ink)
	if not contact.visible:
		_text(centre + Vector2(0, 27.0), BattleText.clock(age), 11, Color(COLOR_HOSTILE_LINE, alpha))


# --- Artillery --------------------------------------------------------------

func _draw_strike(strike: Battle.Strike) -> void:
	var centre := to_screen(strike.target)
	var left := strike.lands_at - battle.time
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_arc(centre, radius, 0.0, TAU, 48, COLOR_STRIKE, 1.5, true)
	draw_line(centre + Vector2(-radius, 0), centre + Vector2(radius, 0), Color(COLOR_STRIKE, 0.6), 1.0)
	draw_line(centre + Vector2(0, -radius), centre + Vector2(0, radius), Color(COLOR_STRIKE, 0.6), 1.0)
	_text(centre + Vector2(0, -radius - 6.0), "ОГОНЬ ЧЕРЕЗ %d С" % ceili(left), 12, COLOR_STRIKE)


func _draw_impacts() -> void:
	for i in range(battle.events.size() - 1, -1, -1):
		var event := battle.events[i]
		var age: float = battle.time - event.time
		if age > 1.5:
			break
		if event.kind != &"strike_landed":
			continue
		var centre := to_screen(event.position)
		var radius := battle.rules.strike_radius * CELL
		draw_circle(centre, radius, Color(0.95, 0.45, 0.1, 0.55 * (1.0 - age / 1.5)), true, -1.0, true)
		draw_arc(centre, radius, 0.0, TAU, 48, Color(0.6, 0.2, 0.05), 2.0, true)


func _draw_strike_cursor() -> void:
	var centre := get_local_mouse_position()
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_arc(centre, radius, 0.0, TAU, 48, COLOR_STRIKE, 2.0, true)
	draw_arc(centre, battle.rules.strike_radius * CELL, 0.0, TAU, 48, Color(COLOR_STRIKE, 0.5), 1.0, true)
	draw_line(centre + Vector2(-radius, 0), centre + Vector2(radius, 0), Color(COLOR_STRIKE, 0.6), 1.0)
	draw_line(centre + Vector2(0, -radius), centre + Vector2(0, radius), Color(COLOR_STRIKE, 0.6), 1.0)


## Centred text with a paper-coloured halo, as labels are printed over map detail.
func _text(at: Vector2, text: String, font_size: int, color: Color) -> void:
	var width := _font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var origin := at + Vector2(-width / 2.0, 0)
	draw_string_outline(_font, origin, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 5, Color(COLOR_PAPER, 0.9 * color.a))
	draw_string(_font, origin, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
