class_name SupplyMapView
extends Control
## Draws the theatre as a schematic map: roads, depot, junctions, company cards and trucks.

signal company_clicked(node_id: int)

const COLOR_TEXT := Color("e6edf3")
const COLOR_MUTED := Color("8fa1b3")
const COLOR_CARD := Color("232f3d")
const COLOR_CARD_LOST := Color("1f2630")
const COLOR_BORDER := Color("3a4a5c")
const COLOR_ACCENT := Color("58a6ff")
const COLOR_SAFE := Color("6f8aa3")
const COLOR_RISKY := Color("e09f3e")
const COLOR_DANGER := Color("e5534b")
const COLOR_GOOD := Color("5fb878")
const COLOR_EMPTY := Color("16202b")
const CARGO_COLORS: Array[Color] = [Color("d9a441"), Color("6fa8dc"), Color("7fbf7f")]

const MARGIN_MIN := Vector2(40, 30)
const MARGIN_MAX := Vector2(30, 30)
const CARD_SIZE := Vector2(230, 118)
const CHIP_SIZE := Vector2(74, 22)
const MIN_LABELLED_ROAD := 200.0

var game: SupplyGame
## Company highlighted as the target of the order being edited.
var selected_company := -1
## Route of the order being edited; drawn on top of the roads.
var highlighted_route := PackedInt32Array()

var _font: Font


func _ready() -> void:
	_font = get_theme_default_font()


func refresh() -> void:
	queue_redraw()


func node_position(node_id: int) -> Vector2:
	var area := size - MARGIN_MIN - MARGIN_MAX
	return MARGIN_MIN + game.map.nodes[node_id].position * area


func card_rect(node_id: int) -> Rect2:
	return Rect2(node_position(node_id) - CARD_SIZE / 2.0, CARD_SIZE)


func _gui_input(event: InputEvent) -> void:
	if game == null or not event is InputEventMouseButton:
		return
	var click := event as InputEventMouseButton
	if not click.pressed or click.button_index != MOUSE_BUTTON_LEFT:
		return
	for company in game.companies:
		if card_rect(company.node).has_point(click.position):
			company_clicked.emit(company.node)
			accept_event()
			return


func _draw() -> void:
	if game == null:
		return
	for road in game.map.roads:
		_draw_road(road)
	for road_id in highlighted_route:
		var road := game.map.roads[road_id]
		draw_line(node_position(road.a), node_position(road.b), COLOR_ACCENT, 5.0, true)
	for node in game.map.nodes:
		match node.kind:
			SupplyMap.Kind.DEPOT:
				_draw_depot(node)
			SupplyMap.Kind.HUB:
				_draw_hub(node)
			SupplyMap.Kind.COMPANY:
				_draw_company(game.get_company(node.id))
	_draw_trucks()
	_draw_legend()


func _draw_road(road: SupplyMap.Road) -> void:
	var from := node_position(road.a)
	var to := node_position(road.b)
	var cut := game.blocked[road.id] > 0
	var label := ""
	var color := COLOR_SAFE
	if cut:
		color = COLOR_DANGER
		label = "перерезана: %d сут." % game.blocked[road.id]
	elif road.risky:
		color = COLOR_RISKY
		label = "засада %d%%" % roundi(game.rules.ambush_chance * 100.0)

	if road.risky:
		draw_dashed_line(from, to, color, 3.0, 10.0)
	else:
		draw_line(from, to, color, 3.0, true)

	var middle := (from + to) / 2.0
	if cut:
		var arm := Vector2(9, 9)
		draw_line(middle - arm, middle + arm, COLOR_DANGER, 4.0, true)
		draw_line(middle + Vector2(-9, 9), middle + Vector2(9, -9), COLOR_DANGER, 4.0, true)
	if label.is_empty() or from.distance_to(to) < MIN_LABELLED_ROAD:
		return
	var width := _font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	var anchor := middle + Vector2(-width / 2.0, -12.0)
	draw_rect(Rect2(anchor + Vector2(-5, -14), Vector2(width + 10, 19)), Color("1b2530"))
	_text(anchor, label, 13, color)


func _draw_depot(node: SupplyMap.MapNode) -> void:
	var center := node_position(node.id)
	var rect := Rect2(center - Vector2(26, 26), Vector2(52, 52))
	draw_rect(rect, COLOR_CARD)
	draw_rect(rect, COLOR_ACCENT, false, 2.0)
	draw_line(rect.position, rect.end, COLOR_ACCENT, 1.5, true)
	draw_line(Vector2(rect.position.x, rect.end.y), Vector2(rect.end.x, rect.position.y), COLOR_ACCENT, 1.5, true)
	_text(Vector2(rect.position.x - 20, rect.position.y - 10), node.title, 16, COLOR_TEXT, 92)


func _draw_hub(node: SupplyMap.MapNode) -> void:
	var center := node_position(node.id)
	draw_circle(center, 13.0, COLOR_CARD)
	draw_arc(center, 13.0, 0.0, TAU, 32, COLOR_SAFE, 2.0, true)
	_text(center + Vector2(-80, -22), node.title, 14, COLOR_MUTED, 160)


func _draw_company(company: SupplyGame.Company) -> void:
	var rect := card_rect(company.node)
	var title := game.map.nodes[company.node].title
	if company.lost:
		draw_rect(rect, COLOR_CARD_LOST)
		draw_rect(rect, COLOR_BORDER, false, 1.0)
		_text(rect.position + Vector2(10, 22), title, 16, COLOR_MUTED)
		_text(rect.position + Vector2(0, 68), "УЧАСТОК ПОТЕРЯН", 16, COLOR_DANGER, CARD_SIZE.x)
		return

	draw_rect(rect, COLOR_CARD)
	var border := COLOR_BORDER
	var border_width := 1.0
	if company.battle_today:
		border = COLOR_DANGER
		border_width = 2.0
	if company.node == selected_company:
		border = COLOR_ACCENT
		border_width = 3.0
	draw_rect(rect, border, false, border_width)

	_text(rect.position + Vector2(10, 22), title, 16, COLOR_TEXT)
	var tag := ""
	var tag_color := COLOR_RISKY
	if company.battle_today and company.battle_tomorrow:
		tag = "бой сегодня и завтра"
		tag_color = COLOR_DANGER
	elif company.battle_today:
		tag = "бой сегодня"
		tag_color = COLOR_DANGER
	elif company.battle_tomorrow:
		tag = "бой завтра"
	if not tag.is_empty():
		_text(rect.position + Vector2(0, 21), tag, 13, tag_color, CARD_SIZE.x - 10, HORIZONTAL_ALIGNMENT_RIGHT)

	_text(rect.position + Vector2(10, 43), "Боеспособность", 13, COLOR_MUTED)
	var pip_color := COLOR_GOOD
	if company.readiness <= 1:
		pip_color = COLOR_DANGER
	elif company.readiness <= 3:
		pip_color = COLOR_RISKY
	for i in game.rules.max_readiness:
		var pip := Rect2(rect.position + Vector2(124 + i * 15, 32), Vector2(12, 12))
		draw_rect(pip, pip_color if i < company.readiness else COLOR_EMPTY)
		draw_rect(pip, COLOR_BORDER, false, 1.0)
	_text(rect.position + Vector2(204, 43), str(company.readiness), 13, COLOR_TEXT)

	var incoming := _incoming(company.node)
	for cargo in SupplyGame.CARGO_COUNT:
		var y := 63.0 + cargo * 18.0
		_text(rect.position + Vector2(10, y), SupplyText.CARGO_TITLES[cargo], 13, COLOR_MUTED)
		for i in game.rules.stock_cap:
			var cell := Rect2(rect.position + Vector2(124 + i * 10, y - 10), Vector2(8, 10))
			draw_rect(cell, CARGO_COLORS[cargo] if i < company.stock[cargo] else COLOR_EMPTY)
		var amount_color := COLOR_DANGER if company.stock[cargo] == 0 else COLOR_TEXT
		_text(rect.position + Vector2(188, y), str(company.stock[cargo]), 13, amount_color)
		if incoming[cargo] > 0:
			_text(rect.position + Vector2(202, y), "+%d" % incoming[cargo], 13, COLOR_ACCENT)


func _draw_trucks() -> void:
	var stacks: Dictionary[int, int] = {}
	for truck in game.trucks:
		if truck.state == SupplyGame.TruckState.LOST:
			continue
		var index: int = stacks.get(truck.node, 0)
		stacks[truck.node] = index + 1
		var origin := _chip_origin(truck.node) + Vector2(0, index * (CHIP_SIZE.y + 3))
		var label := SupplyText.truck_title(truck.id)
		var color := COLOR_MUTED
		match truck.state:
			SupplyGame.TruckState.LOADED, SupplyGame.TruckState.OUTBOUND:
				label += " → %s" % game.map.nodes[truck.target].title.get_slice(" ", 0)
				color = COLOR_ACCENT
			SupplyGame.TruckState.RETURNING:
				label += " ← склад"
				color = COLOR_SAFE
		var rect := Rect2(origin, CHIP_SIZE)
		draw_rect(rect, COLOR_EMPTY)
		draw_rect(rect, color, false, 1.5)
		_text(origin + Vector2(0, 16), label, 12, COLOR_TEXT, CHIP_SIZE.x, HORIZONTAL_ALIGNMENT_CENTER)


func _chip_origin(node_id: int) -> Vector2:
	var center := node_position(node_id)
	match game.map.nodes[node_id].kind:
		SupplyMap.Kind.DEPOT:
			return center + Vector2(-CHIP_SIZE.x / 2.0, 36)
		SupplyMap.Kind.HUB:
			return center + Vector2(-CHIP_SIZE.x / 2.0, 20)
	return Vector2(card_rect(node_id).position.x - CHIP_SIZE.x - 8, center.y - CHIP_SIZE.y / 2.0)


func _draw_legend() -> void:
	var y := size.y - 14.0
	draw_line(Vector2(16, y - 4), Vector2(46, y - 4), COLOR_SAFE, 3.0)
	_text(Vector2(52, y), "безопасная дорога", 12, COLOR_MUTED)
	draw_dashed_line(Vector2(190, y - 4), Vector2(220, y - 4), COLOR_RISKY, 3.0, 8.0)
	_text(Vector2(226, y), "опасная", 12, COLOR_MUTED)
	_text(Vector2(300, y), "+N — груз в пути", 12, COLOR_ACCENT)


## Cargo already loaded or travelling to the company.
func _incoming(node_id: int) -> PackedInt32Array:
	var total := PackedInt32Array([0, 0, 0])
	for truck in game.trucks:
		var on_the_way := (
			truck.state == SupplyGame.TruckState.LOADED
			or truck.state == SupplyGame.TruckState.OUTBOUND
		)
		if on_the_way and truck.target == node_id:
			for cargo in SupplyGame.CARGO_COUNT:
				total[cargo] += truck.cargo[cargo]
	return total


func _text(
	at: Vector2,
	text: String,
	font_size: int,
	color: Color,
	width: float = -1.0,
	alignment: HorizontalAlignment = HORIZONTAL_ALIGNMENT_CENTER
) -> void:
	if width < 0.0:
		alignment = HORIZONTAL_ALIGNMENT_LEFT
	draw_string(_font, at, text, alignment, width, font_size, color)
