class_name BattleMapView
extends Control
## Shows the mission over the painted map: the picture as the ground, a coordinate
## grid, objectives, own units and enemy contacts as round icons. The view
## can be zoomed and dragged. Enemy units themselves are never read here, only
## Battle.contacts.

signal map_clicked(position: Vector2, button: MouseButton)

const COLOR_VOID := Color("0a1626")
const COLOR_TEXT := Color("eaf2fb")
const COLOR_HALO := Color("06101c")
const COLOR_INK := Color("10161e")
const COLOR_GRID := Color(0.85, 0.93, 1.0, 0.13)
const COLOR_GRID_LABEL := Color(0.85, 0.93, 1.0, 0.5)
## Veil over the hexes nobody is watching.
const COLOR_FOG := Color(0.02, 0.05, 0.1, 0.42)

## Frame fills as on a NATO situation map: friendly blue, hostile red, unknown yellow.
const COLOR_FRIEND := Color("8fd0ff")
const COLOR_FRIEND_LINE := Color("4fb0ff")
const COLOR_HOSTILE := Color("ff8a80")
const COLOR_HOSTILE_LINE := Color("ff5a52")
## Multiplied into an enemy icon, turning its white disc pale red.
const COLOR_HOSTILE_TINT := Color("ffc4bd")
const COLOR_UNKNOWN := Color("fff27a")
const COLOR_NEUTRAL := Color("c8d2dc")
const COLOR_STRIKE := Color("ffc24a")

## Diameter of a unit icon on screen.
const ICON := 36.0
const PICK_RADIUS := 20.0
const ZOOM_STEP := 1.15
## The closest view shows this many units of distance across the width.
const CLOSEST_UNITS := 14.0
const PAN_SPEED := 600.0

var battle: Battle
var selected_unit := -1
## While true the cursor shows where an artillery strike would land.
var strike_mode := false

var _font: Font
var _background: Texture2D
## Screen pixels per map cell.
var _scale := 8.0
## Where the map's top left corner is, in view pixels.
var _origin := Vector2.ZERO
var _dragging := false
## Every hex that lies on the map.
var _hexes: Array[Vector2i] = []


func _ready() -> void:
	_font = get_theme_default_font()
	mouse_filter = Control.MOUSE_FILTER_STOP
	clip_contents = true


func set_battle(new_battle: Battle) -> void:
	battle = new_battle
	_background = null
	if not battle.map.background.is_empty():
		_background = load(battle.map.background)
	_hexes.clear()
	var hex_size := battle.hex_size()
	var extent := Vector2(battle.map.size)
	var far := battle.hex_at(extent)
	for r in range(-1, far.y + 2):
		for q in range(-far.y / 2 - 2, far.x + far.y / 2 + 3):
			var middle := HexGrid.centre(Vector2i(q, r), hex_size)
			if middle.x > -hex_size * 0.5 and middle.y > -hex_size * 0.5 \
					and middle.x < extent.x + hex_size * 0.5 and middle.y < extent.y + hex_size * 0.5:
				_hexes.append(Vector2i(q, r))
	# Start with the map filling the view's width, centred on the middle of the map.
	_scale = maxf(size.x / battle.map.size.x, _widest_scale())
	_origin = (size - Vector2(battle.map.size) * _scale) / 2.0
	_clamp_view()
	queue_redraw()


func to_map(point: Vector2) -> Vector2:
	return (point - _origin) / _scale


func to_screen(position: Vector2) -> Vector2:
	return position * _scale + _origin


## Zooms in (steps > 0) or out, keeping the map point under `anchor` where it is.
func zoom(steps: int, anchor: Vector2) -> void:
	var fixed := to_map(anchor)
	var closest := size.x / (CLOSEST_UNITS * battle.map.unit)
	_scale = clampf(_scale * pow(ZOOM_STEP, steps), _widest_scale(), closest)
	_origin = anchor - fixed * _scale
	_clamp_view()
	queue_redraw()


## Moves the view by this many screen pixels.
func pan(offset: Vector2) -> void:
	_origin -= offset
	_clamp_view()
	queue_redraw()


func get_scale_px() -> float:
	return _scale


## The scale at which the whole map just fits into the view.
func _widest_scale() -> float:
	return minf(size.x / battle.map.size.x, size.y / battle.map.size.y)


## Keeps the map on screen: centred along an axis where it is smaller than the view,
## otherwise never showing anything beyond its edge.
func _clamp_view() -> void:
	var extent := Vector2(battle.map.size) * _scale
	for axis in 2:
		if extent[axis] <= size[axis]:
			_origin[axis] = (size[axis] - extent[axis]) / 2.0
		else:
			_origin[axis] = clampf(_origin[axis], size[axis] - extent[axis], 0.0)


## Where the unit is shown, in map coordinates. Units standing together are spread
## sideways so every symbol and call sign stays readable and clickable.
func shown_position(unit: BattleUnit) -> Vector2:
	var shift := 0
	for other in battle.units:
		if other.id >= unit.id:
			break
		if other.side == unit.side and other.is_on_map() and other.position.distance_to(unit.position) < 1.2 * battle.map.unit:
			shift += 1
	return unit.position + Vector2(shift * (ICON + 8.0) / _scale, 0.0)


## Player unit under the point, or -1.
func unit_at(position: Vector2) -> int:
	var best := -1
	var best_distance := PICK_RADIUS / _scale
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
		if BattleMap.cell_centre(objective.cell).distance_to(position) <= battle.rules.capture_radius * battle.map.unit:
			return objective.index
	return -1


func _gui_input(event: InputEvent) -> void:
	if battle == null:
		return
	if event is InputEventMouseButton:
		var click := event as InputEventMouseButton
		match click.button_index:
			MOUSE_BUTTON_WHEEL_UP:
				if click.pressed:
					zoom(1, click.position)
			MOUSE_BUTTON_WHEEL_DOWN:
				if click.pressed:
					zoom(-1, click.position)
			MOUSE_BUTTON_MIDDLE:
				_dragging = click.pressed
			MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT:
				if click.pressed:
					map_clicked.emit(to_map(click.position), click.button_index)
		accept_event()
	elif event is InputEventMouseMotion:
		if _dragging:
			pan(-(event as InputEventMouseMotion).relative)
		elif strike_mode:
			queue_redraw()


func _draw() -> void:
	if battle == null:
		return
	draw_rect(Rect2(Vector2.ZERO, size), COLOR_VOID)
	if _background != null:
		draw_texture_rect(_background, Rect2(_origin, Vector2(battle.map.size) * _scale), false)
	_draw_hexes()
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


## The hex grid is the picture of what the player knows: hexes his units are
## watching are clear, the rest lie under a dark veil. A hex being scouted fills
## with a ring as the work goes on.
func _draw_hexes() -> void:
	var size := battle.hex_size()
	var observed := battle.observed_hexes(BattleUnit.Side.PLAYER)
	var view := Rect2(Vector2.ZERO, self.size).grow(size * _scale)
	var show_names := size * _scale >= 20.0
	for hex in _hexes:
		var middle := to_screen(HexGrid.centre(hex, size))
		if not view.has_point(middle):
			continue
		var points := HexGrid.corners(hex, size)
		for i in points.size():
			points[i] = to_screen(points[i])
		if not observed.has(hex):
			draw_colored_polygon(points, COLOR_FOG)
		points.append(points[0])
		draw_polyline(points, COLOR_GRID, 1.0, true)
		if show_names:
			draw_string(_font, middle + Vector2(-20, -size * _scale * 0.55), HexGrid.title(hex),
					HORIZONTAL_ALIGNMENT_CENTER, 40, 9, COLOR_GRID_LABEL)

	for unit in battle.units:
		if unit.side != BattleUnit.Side.PLAYER or not unit.is_on_map() or unit.scout_queue.is_empty():
			continue
		var progress := battle.scout_progress(unit)
		var strong := unit.id == selected_unit
		for i in mini(UnitKind.SCOUT_BATCH[unit.kind], unit.scout_queue.size()):
			var middle := to_screen(HexGrid.centre(unit.scout_queue[i], size))
			var radius := size * _scale * 0.5
			draw_arc(middle, radius, 0.0, TAU, 32, Color(COLOR_FRIEND_LINE, 0.25), 2.0, true)
			draw_arc(middle, radius, -PI / 2.0, -PI / 2.0 + TAU * progress, 32,
					Color(COLOR_FRIEND_LINE, 1.0 if strong else 0.6), 3.0 if strong else 2.0, true)


# --- Objectives -------------------------------------------------------------

## An objective as a tactical graphic: a closed line in the colour of whoever holds it.
func _draw_objective(objective: BattleMap.Objective) -> void:
	var centre := to_screen(BattleMap.cell_centre(objective.cell))
	var radius := battle.rules.capture_radius * battle.map.unit * _scale
	var owner := battle.owners[objective.index]
	var color := COLOR_NEUTRAL
	if owner == BattleUnit.Side.PLAYER:
		color = COLOR_FRIEND_LINE
	elif owner == BattleUnit.Side.ENEMY:
		color = COLOR_HOSTILE_LINE
	draw_circle(centre, radius, Color(color, 0.14), true, -1.0, true)
	draw_arc(centre, radius, 0.0, TAU, 64, color, 2.5, true)

	var progress := battle.capture_progress[objective.index]
	if progress > 0.0:
		var taker := COLOR_FRIEND_LINE if battle.capture_side[objective.index] == BattleUnit.Side.PLAYER else COLOR_HOSTILE_LINE
		draw_arc(centre, radius + 5.0, -PI / 2.0, -PI / 2.0 + TAU * progress, 64, taker, 4.0, true)
	_text(centre + Vector2(0, -radius - 7.0), "ОБ. " + objective.title.to_upper(), 13, color)


# --- Units ------------------------------------------------------------------

func _draw_unit(unit: BattleUnit) -> void:
	var centre := to_screen(shown_position(unit))
	var radius := ICON / 2.0
	if battle.time - unit.hit_at < 0.8:
		var beat := 0.5 + 0.5 * sin(battle.time * 14.0)
		draw_arc(centre, radius + 6.0 + beat * 2.0, 0.0, TAU, 40, COLOR_HOSTILE_LINE, 3.0, true)
	if unit.id == selected_unit:
		draw_arc(centre, radius + 4.0, 0.0, TAU, 40, COLOR_TEXT, 2.5, true)

	# A wedge on the rim shows where the unit looks: that side is scouted first.
	var nose := centre + unit.facing * (radius + 7.0)
	var across := unit.facing.orthogonal() * 5.0
	draw_colored_polygon(PackedVector2Array([
		nose, centre + unit.facing * (radius - 1.0) + across, centre + unit.facing * (radius - 1.0) - across,
	]), COLOR_FRIEND_LINE)
	_draw_icon(BattleIcons.own(unit.kind), centre, ICON, Color.WHITE)
	# The ring says whose unit it is: blue for own, red for the enemy.
	draw_arc(centre, radius - 1.0, 0.0, TAU, 40, COLOR_FRIEND_LINE, 2.5, true)
	# A squad riding in a carrier is shown as a small icon on the carrier's edge.
	if unit.passenger >= 0:
		var seat := centre + Vector2(radius * 0.8, -radius * 0.8)
		_draw_icon(BattleIcons.own(battle.units[unit.passenger].kind), seat, ICON * 0.55, Color.WHITE)
		draw_arc(seat, ICON * 0.275 - 0.5, 0.0, TAU, 24, COLOR_FRIEND_LINE, 1.5, true)

	# Strength bar under the icon.
	var share := float(unit.strength) / unit.max_strength()
	var bar := Rect2(centre + Vector2(-radius, radius + 3.0), Vector2(ICON, 4.0))
	var bar_color := Color("4fd06a")
	if share <= 0.3:
		bar_color = COLOR_HOSTILE_LINE
	elif share <= 0.6:
		bar_color = Color("f0b030")
	draw_rect(bar, COLOR_HALO)
	draw_rect(Rect2(bar.position, Vector2(bar.size.x * share, bar.size.y)), bar_color)
	draw_rect(bar, COLOR_INK, false, 1.0)

	var title := unit.call_sign
	if unit.passenger >= 0:
		title += " + " + battle.units[unit.passenger].call_sign
	_text(centre + Vector2(0, radius + 21.0), title, 12, COLOR_TEXT)


func _draw_icon(texture: Texture2D, centre: Vector2, diameter: float, tint: Color) -> void:
	var rect := Rect2(centre - Vector2(diameter, diameter) / 2.0, Vector2(diameter, diameter))
	draw_texture_rect(texture, rect, false, tint)


func _draw_fire(unit: BattleUnit) -> void:
	if unit.target < 0 or not battle.contacts.has(unit.target):
		return
	# Tracers flicker instead of drawing a steady line.
	if int(battle.time * 10.0) % 3 == 0:
		return
	var from := to_screen(shown_position(unit))
	var to := to_screen(battle.contacts[unit.target].position)
	draw_dashed_line(from, to, Color(COLOR_STRIKE, 0.9), 1.5, 5.0)


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
	var color := COLOR_FRIEND_LINE if selected else Color(COLOR_FRIEND_LINE, 0.5)
	var width := 3.0 if selected else 2.0
	draw_polyline(points, Color(COLOR_HALO, 0.6), width + 2.0, true)
	draw_polyline(points, color, width, true)
	var end := points[points.size() - 1]
	var back := (points[points.size() - 2] - end).normalized()
	var side := back.orthogonal()
	draw_colored_polygon(PackedVector2Array([
		end - back * 4.0, end + back * 9.0 + side * 6.0, end + back * 9.0 - side * 6.0,
	]), color)


# --- Enemy contacts ---------------------------------------------------------

## An identified contact is the enemy unit's icon tinted red; an unidentified one is
## a yellow disc with a question mark. Old contacts fade.
func _draw_contact(contact: Battle.Contact) -> void:
	var centre := to_screen(contact.position)
	var age := battle.time - contact.last_seen
	var alpha := 1.0
	if not contact.visible:
		alpha = lerpf(0.7, 0.25, clampf(age / battle.rules.contact_fade, 0.0, 1.0))
	var radius := ICON / 2.0
	if contact.error > 0.8 * battle.map.unit:
		draw_arc(centre, contact.error * _scale, 0.0, TAU, 40, Color(COLOR_HOSTILE_LINE, 0.7 * alpha), 1.5, true)

	if contact.kind < 0:
		draw_circle(centre, radius - 2.0, Color(COLOR_UNKNOWN, alpha), true, -1.0, true)
		draw_arc(centre, radius - 2.0, 0.0, TAU, 32, Color(COLOR_INK, alpha), 2.0, true)
		draw_string(_font, centre + Vector2(-10, 6), "?", HORIZONTAL_ALIGNMENT_CENTER, 20, 18, Color(COLOR_INK, alpha))
	else:
		_draw_icon(BattleIcons.hostile(contact.kind), centre, ICON, Color(COLOR_HOSTILE_TINT, alpha))
		draw_arc(centre, radius - 1.0, 0.0, TAU, 40, Color(COLOR_HOSTILE_LINE, alpha), 2.5, true)
	if not contact.visible:
		_text(centre + Vector2(0, radius + 15.0), BattleText.clock(age), 11, Color(COLOR_HOSTILE, alpha))


# --- Artillery --------------------------------------------------------------

func _draw_strike(strike: Battle.Strike) -> void:
	var centre := to_screen(strike.target)
	var left := strike.lands_at - battle.time
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * battle.map.unit * _scale
	draw_arc(centre, radius, 0.0, TAU, 48, COLOR_STRIKE, 2.0, true)
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
		var radius := battle.rules.strike_radius * battle.map.unit * _scale
		draw_circle(centre, radius, Color(1.0, 0.6, 0.2, 0.6 * (1.0 - age / 1.5)), true, -1.0, true)
		draw_arc(centre, radius, 0.0, TAU, 48, COLOR_STRIKE, 2.0, true)


func _draw_strike_cursor() -> void:
	var centre := get_local_mouse_position()
	var radius := (battle.rules.strike_radius + battle.rules.strike_scatter) * battle.map.unit * _scale
	draw_arc(centre, radius, 0.0, TAU, 48, COLOR_STRIKE, 2.0, true)
	draw_arc(centre, battle.rules.strike_radius * battle.map.unit * _scale, 0.0, TAU, 48, Color(COLOR_STRIKE, 0.5), 1.0, true)
	draw_line(centre + Vector2(-radius, 0), centre + Vector2(radius, 0), Color(COLOR_STRIKE, 0.6), 1.0)
	draw_line(centre + Vector2(0, -radius), centre + Vector2(0, radius), Color(COLOR_STRIKE, 0.6), 1.0)


## Centred light text with a dark halo, readable over any part of the picture.
func _text(at: Vector2, text: String, font_size: int, color: Color) -> void:
	var width := _font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var origin := at + Vector2(-width / 2.0, 0)
	draw_string_outline(_font, origin, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 6, Color(COLOR_HALO, 0.9 * color.a))
	draw_string(_font, origin, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
