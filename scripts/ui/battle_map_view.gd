class_name BattleMapView
extends Control
## Draws the mission as a night operations map: dark terrain in line art, own units
## as icon tiles, enemy contacts as red marks. Enemy units themselves are never read
## here, only Battle.contacts.

signal map_clicked(position: Vector2, button: MouseButton)

const CELL := 16.0

const COLOR_LAND := Color("0c2135")
const COLOR_FOREST := Color("0e2d38")
const COLOR_TREE := Color("1c5258")
const COLOR_FOREST_EDGE := Color("1a4a50")
const COLOR_HILL := Color("11283f")
const COLOR_CONTOUR := Color("2c6b8c")
const COLOR_WATER := Color("15495e")
const COLOR_SHORE := Color("2f8ba3")
const COLOR_TOWN := Color("112c44")
const COLOR_BUILDING := Color("2d6184")
const COLOR_ROAD := Color("3a86a8")
const COLOR_BRIDGE := Color("8fdcf2")
const COLOR_GRID := Color(0.45, 0.85, 1.0, 0.07)

const COLOR_HUD := Color("7fd8f5")
const COLOR_HUD_DIM := Color("4d8ba6")
const COLOR_PLATE := Color(0.02, 0.07, 0.12, 0.82)
const COLOR_OWN := Color("1fa3dc")
const COLOR_OWN_DARK := Color("0e5f86")
const COLOR_ENEMY := Color("e0283c")
const COLOR_ENEMY_DARK := Color("7a1420")
const COLOR_NEUTRAL := Color("7d8f9c")
const COLOR_ICON := Color("f2fbff")
const COLOR_WARNING := Color("ffb347")

const TILE_SIZE := Vector2(30, 24)
## The tile floats this far above the unit's exact position and points down at it.
const TILE_LIFT := 26.0
const CONTACT_SIZE := Vector2(20, 20)
const PICK_RADIUS := 10.0
const PIPS := 4
const CHAMFER := 6

## Region of a terrain pixel, used to trace shores, forest edges and contour lines.
const REGION_LAND := 0
const REGION_FOREST := 1
const REGION_WATER := 2
const REGION_HILL := 3

var battle: Battle
var selected_unit := -1
## While true the cursor shows where an artillery strike would land.
var strike_mode := false

var _terrain: ImageTexture
var _font: Font


func _ready() -> void:
	_font = get_theme_default_font()
	mouse_filter = Control.MOUSE_FILTER_STOP


func set_battle(new_battle: Battle) -> void:
	battle = new_battle
	_terrain = ImageTexture.create_from_image(_paint_terrain())
	custom_minimum_size = Vector2(battle.map.size) * CELL
	queue_redraw()


func to_map(point: Vector2) -> Vector2:
	return point / CELL


func to_screen(position: Vector2) -> Vector2:
	return position * CELL


## Where the unit is shown, in map coordinates. Units standing together are spread
## sideways so every tile and call sign stays readable and clickable.
func shown_position(unit: BattleUnit) -> Vector2:
	var shift := 0
	for other in battle.units:
		if other.id >= unit.id:
			break
		if other.side == unit.side and other.is_on_map() and other.position.distance_to(unit.position) < 1.2:
			shift += 1
	return unit.position + Vector2(shift * (TILE_SIZE.x + 6.0) / CELL, 0.0)


## Player unit whose tile or position is under the point, or -1.
func unit_at(position: Vector2) -> int:
	var point := to_screen(position)
	var best := -1
	var best_distance := INF
	for unit in battle.units:
		if unit.side != BattleUnit.Side.PLAYER or not unit.is_on_map():
			continue
		var anchor := to_screen(shown_position(unit))
		var distance := anchor.distance_to(point)
		if distance > PICK_RADIUS and not _tile_rect(anchor).grow(3.0).has_point(point):
			continue
		if distance < best_distance:
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
	draw_texture(_terrain, Vector2.ZERO)
	_draw_grid_labels()
	for objective in battle.map.objectives:
		_draw_objective(objective)
	_draw_selected_path()
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

## Paints the terrain once per mission. Regions get cut corners instead of square
## ones, then every border between two regions is traced as a thin line.
func _paint_terrain() -> Image:
	var map := battle.map
	var cell := int(CELL)
	var width := map.size.x * cell
	var height := map.size.y * cell
	var image := Image.create(width, height, false, Image.FORMAT_RGB8)
	var regions := Image.create(width, height, false, Image.FORMAT_L8)
	image.fill(COLOR_LAND)
	var depth := _hill_depth()
	var noise := RandomNumberGenerator.new()
	noise.seed = 20261006

	for y in map.size.y:
		for x in map.size.x:
			var at := Vector2i(x, y)
			var rect := Rect2i(at * cell, Vector2i(cell, cell))
			image.fill_rect(rect, _cell_color(at, depth))
			regions.fill_rect(rect, _region_color(_region(at, depth)))
	for y in map.size.y:
		for x in map.size.x:
			_cut_corners(image, regions, Vector2i(x, y), depth)

	for y in map.size.y:
		for x in map.size.x:
			var at := Vector2i(x, y)
			var origin := at * cell
			match map.get_terrain(at):
				Terrain.Type.FOREST:
					for i in 3:
						var tree := origin + Vector2i(noise.randi_range(3, cell - 5), noise.randi_range(3, cell - 5))
						image.fill_rect(Rect2i(tree, Vector2i(2, 2)), COLOR_TREE)
				Terrain.Type.TOWN:
					var house := origin + Vector2i(noise.randi_range(2, 4), noise.randi_range(2, 5))
					var house_size := Vector2i(noise.randi_range(7, 10), noise.randi_range(6, 8))
					image.fill_rect(Rect2i(house, house_size), COLOR_BUILDING)

	_trace_borders(image, regions)

	for y in map.size.y:
		for x in map.size.x:
			var at := Vector2i(x, y)
			var type := map.get_terrain(at)
			if type == Terrain.Type.ROAD or type == Terrain.Type.BRIDGE:
				_paint_road_cell(image, at, type == Terrain.Type.BRIDGE)

	var square := BattleMap.SQUARE_CELLS * cell
	for x in range(square, width, square):
		_blend_rect(image, Rect2i(x, 0, 1, height), COLOR_GRID)
	for y in range(square, height, square):
		_blend_rect(image, Rect2i(0, y, width, 1), COLOR_GRID)
	return image


func _region(at: Vector2i, depth: PackedInt32Array) -> int:
	match battle.map.get_terrain(at):
		Terrain.Type.FOREST:
			return REGION_FOREST
		Terrain.Type.WATER, Terrain.Type.BRIDGE:
			return REGION_WATER
		Terrain.Type.HILL:
			return REGION_HILL + depth[at.y * battle.map.size.x + at.x] - 1
	return REGION_LAND


func _region_color(region: int) -> Color:
	return Color8(region * 20, region * 20, region * 20)


func _cell_color(at: Vector2i, depth: PackedInt32Array) -> Color:
	match battle.map.get_terrain(at):
		Terrain.Type.FOREST:
			return COLOR_FOREST
		Terrain.Type.WATER, Terrain.Type.BRIDGE:
			return COLOR_WATER
		Terrain.Type.HILL:
			return COLOR_HILL.lightened(0.035 * depth[at.y * battle.map.size.x + at.x])
		Terrain.Type.TOWN:
			return COLOR_TOWN
	return COLOR_LAND


## Replaces each outer corner of a forest, water or hill cell with a diagonal cut.
func _cut_corners(image: Image, regions: Image, at: Vector2i, depth: PackedInt32Array) -> void:
	var region := _region(at, depth)
	if region == REGION_LAND:
		return
	var cell := int(CELL)
	for corner: Vector2i in [Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(1, 1)]:
		var side := at + Vector2i(corner.x, 0)
		var above := at + Vector2i(0, corner.y)
		if not _is_outside(region, side, depth) or not _is_outside(region, above, depth):
			continue
		var color := _cell_color(side, depth) if battle.map.contains(side) else COLOR_LAND
		var outer := _region_color(_region(side, depth) if battle.map.contains(side) else REGION_LAND)
		for row in CHAMFER:
			var length := CHAMFER - row
			var x := at.x * cell if corner.x < 0 else (at.x + 1) * cell - length
			var y := at.y * cell + row if corner.y < 0 else (at.y + 1) * cell - 1 - row
			image.fill_rect(Rect2i(x, y, length, 1), color)
			regions.fill_rect(Rect2i(x, y, length, 1), outer)


## A neighbour is outside when it is another kind of terrain or a lower step of a hill.
func _is_outside(region: int, neighbour: Vector2i, depth: PackedInt32Array) -> bool:
	if not battle.map.contains(neighbour):
		return false
	var other := _region(neighbour, depth)
	return other < region if region >= REGION_HILL else other != region


func _trace_borders(image: Image, regions: Image) -> void:
	var width := image.get_width()
	var height := image.get_height()
	var ids := regions.get_data()
	var pixels := image.get_data()
	var hill := REGION_HILL * 20
	var water := REGION_WATER * 20
	for y in height - 1:
		var row := y * width
		for x in width - 1:
			var here := ids[row + x]
			var other := ids[row + x + 1]
			if other == here:
				other = ids[row + width + x]
				if other == here:
					continue
			var color := COLOR_FOREST_EDGE
			if here == water or other == water:
				color = COLOR_SHORE
			elif here >= hill or other >= hill:
				color = COLOR_CONTOUR
			var index := (row + x) * 3
			pixels[index] = color.r8
			pixels[index + 1] = color.g8
			pixels[index + 2] = color.b8
	image.set_data(width, height, false, Image.FORMAT_RGB8, pixels)


func _paint_road_cell(image: Image, at: Vector2i, bridge: bool) -> void:
	var cell := int(CELL)
	var width := 4 if bridge else 2
	var color := COLOR_BRIDGE if bridge else COLOR_ROAD
	var centre := at * cell + Vector2i(cell / 2, cell / 2)
	image.fill_rect(Rect2i(centre - Vector2i(width / 2, width / 2), Vector2i(width, width)), color)
	for step: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
		var type := battle.map.get_terrain(at + step)
		var joins := type == Terrain.Type.ROAD or type == Terrain.Type.BRIDGE
		# Roads run off the edge of the map instead of ending short of it.
		if not joins and battle.map.contains(at + step):
			continue
		var arm := Rect2i(centre - Vector2i(width / 2, width / 2), Vector2i(width, width))
		if step.x != 0:
			arm.size.x = cell / 2
			arm.position.x = centre.x if step.x > 0 else centre.x - cell / 2
		else:
			arm.size.y = cell / 2
			arm.position.y = centre.y if step.y > 0 else centre.y - cell / 2
		image.fill_rect(arm, color)


func _blend_rect(image: Image, rect: Rect2i, color: Color) -> void:
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			image.set_pixel(x, y, image.get_pixel(x, y).blend(color))


## For every cell: 0 off a hill, otherwise how many cells deep inside the hill it lies.
func _hill_depth() -> PackedInt32Array:
	var map := battle.map
	var depth := PackedInt32Array()
	depth.resize(map.size.x * map.size.y)
	for level in range(1, 6):
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


func _draw_grid_labels() -> void:
	var square := BattleMap.SQUARE_CELLS * CELL
	for column in ceili(battle.map.size.x / float(BattleMap.SQUARE_CELLS)):
		for row in ceili(battle.map.size.y / float(BattleMap.SQUARE_CELLS)):
			var label := "%s%d" % [BattleMap.SQUARE_LETTERS[column], row + 1]
			draw_string(_font, Vector2(column * square + 4, row * square + 13), label,
					HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(COLOR_HUD_DIM, 0.55))


# --- Objectives -------------------------------------------------------------

func _draw_objective(objective: BattleMap.Objective) -> void:
	var centre := to_screen(BattleMap.cell_centre(objective.cell))
	var radius := battle.rules.capture_radius * CELL
	var owner := battle.owners[objective.index]
	var color := COLOR_NEUTRAL
	if owner == BattleUnit.Side.PLAYER:
		color = COLOR_OWN
	elif owner == BattleUnit.Side.ENEMY:
		color = COLOR_ENEMY
	draw_circle(centre, radius, Color(color, 0.1))
	draw_arc(centre, radius, 0.0, TAU, 48, Color(color, 0.9), 1.5, true)
	draw_arc(centre, radius + 3.0, 0.0, TAU, 48, Color(color, 0.25), 3.0, true)

	var progress := battle.capture_progress[objective.index]
	if progress > 0.0:
		var taker := COLOR_OWN if battle.capture_side[objective.index] == BattleUnit.Side.PLAYER else COLOR_ENEMY
		draw_arc(centre, radius + 7.0, -PI / 2.0, -PI / 2.0 + TAU * progress, 48, taker.lightened(0.3), 4.0, true)

	# Badge: a hexagon above the zone with the objective's letter.
	var badge := centre + Vector2(0, -radius - 20.0)
	var hexagon := PackedVector2Array()
	for i in 6:
		hexagon.append(badge + Vector2.from_angle(TAU * i / 6.0 + PI / 6.0) * 13.0)
	draw_colored_polygon(hexagon, color.darkened(0.45))
	hexagon.append(hexagon[0])
	draw_polyline(hexagon, color.lightened(0.25), 2.0, true)
	draw_line(badge + Vector2(0, 13), centre + Vector2(0, -radius), Color(color, 0.8), 1.5)
	var letter := BattleMap.SQUARE_LETTERS[objective.index]
	draw_string(_font, badge + Vector2(-10, 5), letter, HORIZONTAL_ALIGNMENT_CENTER, 20, 13, COLOR_ICON)
	_label(centre + Vector2(0, radius + 16.0), objective.title.to_upper(), 12, color.lightened(0.45))


# --- Units ------------------------------------------------------------------

func _tile_rect(anchor: Vector2) -> Rect2:
	return Rect2(anchor + Vector2(-TILE_SIZE.x / 2.0, -TILE_LIFT - TILE_SIZE.y / 2.0), TILE_SIZE)


func _draw_unit(unit: BattleUnit) -> void:
	var anchor := to_screen(shown_position(unit))
	var rect := _tile_rect(anchor)
	var hit := battle.time - unit.hit_at < 0.6
	var fill := COLOR_OWN
	var edge := fill.lightened(0.45)
	# Under fire: a red frame around the tile. The tile itself stays blue so that
	# it is never mistaken for an enemy mark.
	if hit:
		draw_rect(rect.grow(5.0), COLOR_ENEMY, false, 2.0)
		draw_rect(rect.grow(8.0), Color(COLOR_ENEMY, 0.35), false, 2.0)

	# Pointer from the tile down to the exact position.
	var tip := PackedVector2Array([
		Vector2(rect.get_center().x - 6.0, rect.end.y - 1.0),
		Vector2(rect.get_center().x + 6.0, rect.end.y - 1.0),
		anchor + Vector2(0, -4.0),
	])
	draw_colored_polygon(tip, fill)
	draw_circle(anchor, 3.0, COLOR_ICON)
	draw_circle(anchor, 5.0, Color(fill, 0.35))

	draw_rect(rect.grow(2.0), Color(fill, 0.25))
	draw_rect(rect, fill.darkened(0.15))
	draw_rect(rect, edge, false, 1.5)
	_draw_pictogram(unit.kind, rect.get_center(), COLOR_ICON)

	# Strength as pips above the tile, like a charge indicator.
	var filled := ceili(float(unit.strength) / unit.max_strength() * PIPS)
	var pip_color := COLOR_ICON if filled > 1 else COLOR_WARNING
	for i in PIPS:
		var pip := Rect2(Vector2(rect.position.x + i * 7.0, rect.position.y - 8.0), Vector2(5, 5))
		if i < filled:
			draw_rect(pip, pip_color)
		else:
			draw_rect(pip, Color(COLOR_HUD_DIM, 0.8), false, 1.0)

	if unit.passenger >= 0:
		var badge := Rect2(Vector2(rect.end.x - 4.0, rect.position.y - 9.0), Vector2(10, 10))
		draw_rect(badge, COLOR_ICON)
		draw_string(_font, badge.position + Vector2(1.5, 9.0), "+", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_OWN_DARK)

	if unit.id == selected_unit:
		_draw_brackets(rect.grow(7.0), COLOR_ICON)

	var title := unit.call_sign.to_upper()
	if unit.passenger >= 0:
		title += " + " + battle.units[unit.passenger].call_sign.to_upper()
	_label(anchor + Vector2(0, 19.0), title, 11, COLOR_HUD)


## Small white picture inside a unit tile.
func _draw_pictogram(kind: UnitKind.Type, centre: Vector2, color: Color) -> void:
	match kind:
		UnitKind.Type.RIFLE:
			# Two crossed rifles.
			draw_line(centre + Vector2(-8, 6), centre + Vector2(8, -6), color, 2.0, true)
			draw_line(centre + Vector2(-8, -6), centre + Vector2(8, 6), color, 2.0, true)
		UnitKind.Type.SCOUT:
			# Binoculars.
			draw_arc(centre + Vector2(-5, 1), 4.5, 0.0, TAU, 20, color, 2.0, true)
			draw_arc(centre + Vector2(5, 1), 4.5, 0.0, TAU, 20, color, 2.0, true)
			draw_line(centre + Vector2(-1, -1), centre + Vector2(1, -1), color, 2.0)
		UnitKind.Type.APC:
			# Hull on wheels.
			var hull := PackedVector2Array([
				centre + Vector2(-10, 2), centre + Vector2(-7, -5), centre + Vector2(6, -5),
				centre + Vector2(10, -1), centre + Vector2(10, 2),
			])
			draw_colored_polygon(hull, color)
			for x: float in [-6.5, 0.0, 6.5]:
				draw_circle(centre + Vector2(x, 5.0), 2.4, color)


func _draw_brackets(rect: Rect2, color: Color) -> void:
	var arm := 7.0
	for corner: Vector2 in [Vector2(0, 0), Vector2(1, 0), Vector2(0, 1), Vector2(1, 1)]:
		var point := rect.position + rect.size * corner
		var inward := Vector2(1.0 - corner.x * 2.0, 1.0 - corner.y * 2.0)
		draw_line(point, point + Vector2(inward.x * arm, 0), color, 2.0)
		draw_line(point, point + Vector2(0, inward.y * arm), color, 2.0)


func _draw_fire(unit: BattleUnit) -> void:
	if unit.target < 0 or not battle.contacts.has(unit.target):
		return
	# Tracers flicker instead of drawing a steady line.
	if int(battle.time * 10.0) % 3 == 0:
		return
	var from := to_screen(shown_position(unit))
	var to := to_screen(battle.contacts[unit.target].position)
	draw_dashed_line(from, to, Color(COLOR_WARNING, 0.9), 1.5, 6.0)


func _draw_selected_path() -> void:
	var unit := battle.get_unit(selected_unit)
	if unit == null or not unit.is_on_map() or not unit.is_moving():
		return
	var points := PackedVector2Array([to_screen(unit.position)])
	for i in range(unit.path_index, unit.path.size()):
		points.append(to_screen(unit.path[i]))
	if points.size() >= 2:
		draw_polyline(points, Color(COLOR_HUD, 0.25), 6.0, true)
		draw_polyline(points, COLOR_HUD, 2.0, true)
		draw_circle(points[points.size() - 1], 5.0, Color(COLOR_HUD, 0.35))
		draw_circle(points[points.size() - 1], 3.0, COLOR_ICON)


# --- Enemy contacts ---------------------------------------------------------

func _draw_contact(contact: Battle.Contact) -> void:
	var centre := to_screen(contact.position)
	var age := battle.time - contact.last_seen
	var alpha := 1.0
	if not contact.visible:
		alpha = lerpf(0.7, 0.18, clampf(age / battle.rules.contact_fade, 0.0, 1.0))
	if contact.error > 0.8:
		draw_arc(centre, contact.error * CELL, 0.0, TAU, 32, Color(COLOR_ENEMY, alpha * 0.55), 1.0, true)
	var rect := Rect2(centre - CONTACT_SIZE / 2.0, CONTACT_SIZE)
	if contact.visible:
		draw_rect(rect.grow(3.0), Color(COLOR_ENEMY, 0.3))
	draw_rect(rect, Color(COLOR_ENEMY if contact.visible else COLOR_ENEMY_DARK, alpha))
	draw_rect(rect, Color(COLOR_ENEMY.lightened(0.4), alpha), false, 1.5)
	var icon := Color(COLOR_ICON, alpha)
	match contact.kind:
		UnitKind.Type.RIFLE:
			draw_line(centre + Vector2(-5, 4), centre + Vector2(5, -4), icon, 2.0, true)
			draw_line(centre + Vector2(-5, -4), centre + Vector2(5, 4), icon, 2.0, true)
		UnitKind.Type.SCOUT:
			draw_arc(centre + Vector2(-3.5, 0.5), 3.0, 0.0, TAU, 16, icon, 1.5, true)
			draw_arc(centre + Vector2(3.5, 0.5), 3.0, 0.0, TAU, 16, icon, 1.5, true)
		UnitKind.Type.APC:
			draw_rect(Rect2(centre + Vector2(-6, -4), Vector2(12, 6)), icon)
			draw_circle(centre + Vector2(-4, 4), 1.8, icon)
			draw_circle(centre + Vector2(4, 4), 1.8, icon)
		_:
			draw_string(_font, centre + Vector2(-10, 5), "?", HORIZONTAL_ALIGNMENT_CENTER, 20, 14, icon)
	if not contact.visible:
		_label(centre + Vector2(0, CONTACT_SIZE.y / 2.0 + 13.0), BattleText.clock(age), 10, Color(COLOR_ENEMY.lightened(0.35), alpha))


# --- Artillery --------------------------------------------------------------

func _draw_strike(strike: Battle.Strike) -> void:
	var centre := to_screen(strike.target)
	var left := strike.lands_at - battle.time
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_arc(centre, radius, 0.0, TAU, 40, COLOR_WARNING, 1.5, true)
	draw_arc(centre, radius * clampf(left / battle.rules.strike_delay, 0.0, 1.0), 0.0, TAU, 40, Color(COLOR_WARNING, 0.5), 1.0, true)
	draw_line(centre + Vector2(-8, 0), centre + Vector2(8, 0), COLOR_WARNING, 1.5)
	draw_line(centre + Vector2(0, -8), centre + Vector2(0, 8), COLOR_WARNING, 1.5)
	_label(centre + Vector2(0, -radius - 5.0), "УДАР ЧЕРЕЗ %d С" % ceili(left), 11, COLOR_WARNING)


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
		draw_circle(centre, radius, Color(1.0, 0.6, 0.2, 0.55 * (1.0 - age / 1.5)))
		draw_arc(centre, radius, 0.0, TAU, 40, COLOR_WARNING, 2.0, true)


func _draw_strike_cursor() -> void:
	var centre := get_local_mouse_position()
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * CELL
	draw_arc(centre, radius, 0.0, TAU, 40, COLOR_WARNING, 2.0, true)
	draw_arc(centre, battle.rules.strike_radius * CELL, 0.0, TAU, 40, Color(COLOR_WARNING, 0.5), 1.0, true)
	draw_line(centre + Vector2(-10, 0), centre + Vector2(10, 0), COLOR_WARNING, 1.5)
	draw_line(centre + Vector2(0, -10), centre + Vector2(0, 10), COLOR_WARNING, 1.5)


## Centred text on a dark plate so it stays readable over any terrain.
func _label(at: Vector2, text: String, font_size: int, color: Color) -> void:
	var width := _font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var plate := Rect2(at + Vector2(-width / 2.0 - 4.0, -font_size), Vector2(width + 8.0, font_size + 4.0))
	draw_rect(plate, Color(COLOR_PLATE, COLOR_PLATE.a * color.a))
	draw_string(_font, at + Vector2(-width / 2.0, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
