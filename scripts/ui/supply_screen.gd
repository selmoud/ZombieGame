class_name SupplyScreen
extends Control
## The game screen: map on the left, trucks, order editor and daily report on the right.
## All rules live in SupplyGame; this script only shows the state and passes orders.

const PANEL_WIDTH := 400
const BAR_HEIGHT := 52
const MAX_ROUTE_CHOICES := 3
const DEFAULT_CARGO := 2

const COLOR_BACKGROUND := Color("1b2530")
const COLOR_PANEL := Color("202b38")

var game: SupplyGame

var _map: SupplyMapView
var _status: Label
var _end_turn_button: Button
var _side: VBoxContainer
var _overlay: PanelContainer
var _overlay_text: Label

## Truck whose order is being edited, or -1.
var _truck := -1
var _target := -1
var _cargo := PackedInt32Array([0, 0, 0])
var _routes: Array[PackedInt32Array] = []
var _route_index := 0


func _ready() -> void:
	_build_layout()
	start_mission(randi())


func start_mission(seed_value: int) -> void:
	game = SupplyGame.new(seed_value)
	_map.game = game
	_overlay.hide()
	_close_editor()


func select_truck(truck_id: int) -> void:
	if game.is_over() or game.trucks[truck_id].state != SupplyGame.TruckState.IDLE:
		return
	_truck = truck_id
	_target = -1
	_cargo.fill(DEFAULT_CARGO)
	_routes = []
	_route_index = 0
	_refresh()


func select_target(node_id: int) -> void:
	var company := game.get_company(node_id)
	if _truck < 0 or company == null or company.lost:
		return
	_target = node_id
	_routes = game.get_routes(node_id).slice(0, MAX_ROUTE_CHOICES)
	_route_index = _default_route()
	_refresh()


func select_route(index: int) -> void:
	if index < 0 or index >= _routes.size():
		return
	_route_index = index
	_refresh()


func change_cargo(cargo: int, delta: int) -> void:
	var amount := _cargo[cargo] + delta
	if amount < 0 or _cargo_total() + delta > game.rules.truck_capacity:
		return
	_cargo[cargo] = amount
	_refresh()


func can_confirm() -> bool:
	return _truck >= 0 and _target >= 0 and _cargo_total() > 0


func confirm_order() -> bool:
	if not can_confirm():
		return false
	var error := game.give_order(_truck, _target, _cargo, _routes[_route_index])
	if not error.is_empty():
		push_warning("Order rejected: %s" % error)
		return false
	_close_editor()
	return true


func cancel_order(truck_id: int) -> void:
	game.cancel_order(truck_id)
	_refresh()


func end_turn() -> void:
	if game.is_over():
		return
	game.end_turn()
	_close_editor()


func is_result_shown() -> bool:
	return _overlay.visible


## Truck, target, cargo and route of the order being edited; truck is -1 when none is.
func get_draft() -> Dictionary:
	return {
		"truck": _truck,
		"target": _target,
		"cargo": _cargo.duplicate(),
		"route": _routes[_route_index] if _target >= 0 else PackedInt32Array(),
	}


## The safe open road when there is one, otherwise the first open road.
## A risky road is never preselected while a safe one is available.
func _default_route() -> int:
	var first_open := -1
	for i in _routes.size():
		if game.is_route_blocked(_routes[i]):
			continue
		if game.map.count_risky(_routes[i]) == 0:
			return i
		if first_open < 0:
			first_open = i
	return maxi(first_open, 0)


func _close_editor() -> void:
	_truck = -1
	_target = -1
	_routes = []
	_refresh()


func _cargo_total() -> int:
	return _cargo[0] + _cargo[1] + _cargo[2]


func _build_layout() -> void:
	var background := ColorRect.new()
	background.color = COLOR_BACKGROUND
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)

	var bar := PanelContainer.new()
	bar.add_theme_stylebox_override("panel", _flat(COLOR_PANEL, 16, 8))
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.offset_bottom = BAR_HEIGHT
	add_child(bar)
	var bar_row := HBoxContainer.new()
	bar_row.add_theme_constant_override("separation", 24)
	bar.add_child(bar_row)
	var title := Label.new()
	title.text = "Снабжение фронта"
	title.add_theme_font_size_override("font_size", 20)
	bar_row.add_child(title)
	_status = Label.new()
	_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_status.add_theme_color_override("font_color", SupplyMapView.COLOR_MUTED)
	bar_row.add_child(_status)
	_end_turn_button = Button.new()
	_end_turn_button.text = "Конец хода"
	_end_turn_button.custom_minimum_size = Vector2(150, 0)
	_end_turn_button.pressed.connect(end_turn)
	bar_row.add_child(_end_turn_button)

	_map = SupplyMapView.new()
	_map.set_anchors_preset(Control.PRESET_FULL_RECT)
	_map.offset_top = BAR_HEIGHT
	_map.offset_right = -PANEL_WIDTH
	_map.company_clicked.connect(select_target)
	add_child(_map)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _flat(COLOR_PANEL, 14, 12))
	panel.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	panel.offset_left = -PANEL_WIDTH
	panel.offset_top = BAR_HEIGHT
	add_child(panel)
	_side = VBoxContainer.new()
	_side.add_theme_constant_override("separation", 6)
	panel.add_child(_side)

	_overlay = PanelContainer.new()
	_overlay.add_theme_stylebox_override("panel", _flat(Color("2b3a4c"), 36, 28))
	_overlay.set_anchors_preset(Control.PRESET_CENTER)
	_overlay.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_overlay.grow_vertical = Control.GROW_DIRECTION_BOTH
	add_child(_overlay)
	var overlay_box := VBoxContainer.new()
	overlay_box.add_theme_constant_override("separation", 18)
	_overlay.add_child(overlay_box)
	_overlay_text = Label.new()
	_overlay_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_overlay_text.add_theme_font_size_override("font_size", 20)
	overlay_box.add_child(_overlay_text)
	var again := Button.new()
	again.text = "Новая миссия"
	again.pressed.connect(func() -> void: start_mission(randi()))
	overlay_box.add_child(again)


func _refresh() -> void:
	var rules := game.rules
	# After the last turn the counter has already moved on to a day that is not played.
	var shown_day := game.day - 1 if game.is_over() else game.day
	_status.text = "Сутки %d из %d     Потеряно участков: %d из %d     Грузовиков: %d из %d" % [
		shown_day, rules.days,
		game.get_lost_count(), rules.sectors_to_lose,
		game.get_trucks_alive(), rules.truck_count,
	]
	_end_turn_button.disabled = game.is_over()

	_map.selected_company = _target
	_map.highlighted_route = _routes[_route_index] if _target >= 0 else PackedInt32Array()
	_map.refresh()

	# The handler of a button in this panel may be what triggered the rebuild,
	# so old rows are hidden now and freed after the signal returns.
	for child in _side.get_children():
		child.hide()
		child.queue_free()
	_add_heading("Грузовики")
	for truck in game.trucks:
		_add_truck_row(truck)
	_side.add_child(HSeparator.new())
	# The panel is too short for both, and the report is read before giving orders.
	if _truck >= 0:
		_add_editor()
	else:
		_add_report()

	if game.is_over():
		_show_result()


func _add_truck_row(truck: SupplyGame.Truck) -> void:
	var row := HBoxContainer.new()
	var label := Label.new()
	label.text = "%s  %s" % [SupplyText.truck_title(truck.id), SupplyText.truck_status(game, truck)]
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.add_theme_font_size_override("font_size", 14)
	if truck.state == SupplyGame.TruckState.LOST:
		label.add_theme_color_override("font_color", SupplyMapView.COLOR_DANGER)
	elif truck.id == _truck:
		label.add_theme_color_override("font_color", SupplyMapView.COLOR_ACCENT)
	row.add_child(label)

	var truck_id := truck.id
	if truck.state == SupplyGame.TruckState.IDLE and not game.is_over():
		var order := Button.new()
		order.text = "Приказ"
		order.disabled = truck.id == _truck
		order.pressed.connect(func() -> void: select_truck(truck_id))
		row.add_child(order)
	elif truck.state == SupplyGame.TruckState.LOADED:
		var cancel := Button.new()
		cancel.text = "Отменить"
		cancel.pressed.connect(func() -> void: cancel_order(truck_id))
		row.add_child(cancel)
	_side.add_child(row)


func _add_editor() -> void:
	_add_heading("Приказ грузовику %s" % SupplyText.truck_title(_truck))

	var targets := HBoxContainer.new()
	for company in game.companies:
		var button := Button.new()
		button.text = SupplyText.node_title(game, company.node).get_slice(" ", 0)
		button.toggle_mode = true
		button.button_pressed = company.node == _target
		button.disabled = company.lost
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var node_id := company.node
		button.pressed.connect(func() -> void: select_target(node_id))
		targets.add_child(button)
	_side.add_child(targets)
	if _target < 0:
		_add_note("Выберите роту здесь или на карте.")

	for cargo in SupplyGame.CARGO_COUNT:
		var row := HBoxContainer.new()
		var label := Label.new()
		label.text = SupplyText.CARGO_TITLES[cargo]
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.add_theme_color_override("font_color", SupplyMapView.CARGO_COLORS[cargo])
		row.add_child(label)
		var cargo_id := cargo
		var minus := Button.new()
		minus.text = "−"
		minus.custom_minimum_size = Vector2(34, 0)
		minus.disabled = _cargo[cargo] == 0
		minus.pressed.connect(func() -> void: change_cargo(cargo_id, -1))
		row.add_child(minus)
		var amount := Label.new()
		amount.text = str(_cargo[cargo])
		amount.custom_minimum_size = Vector2(28, 0)
		amount.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		row.add_child(amount)
		var plus := Button.new()
		plus.text = "+"
		plus.custom_minimum_size = Vector2(34, 0)
		plus.disabled = _cargo_total() >= game.rules.truck_capacity
		plus.pressed.connect(func() -> void: change_cargo(cargo_id, 1))
		row.add_child(plus)
		_side.add_child(row)
	_add_note("Загружено %d из %d" % [_cargo_total(), game.rules.truck_capacity])

	if _target >= 0:
		var group := ButtonGroup.new()
		for i in _routes.size():
			var route := _routes[i]
			var choice := CheckBox.new()
			choice.button_group = group
			choice.button_pressed = i == _route_index
			choice.text = "%s\n%s" % [
				SupplyText.route_chain(game, route), SupplyText.route_summary(game, route),
			]
			choice.add_theme_font_size_override("font_size", 13)
			var index := i
			choice.pressed.connect(func() -> void: select_route(index))
			_side.add_child(choice)

	var actions := HBoxContainer.new()
	var send := Button.new()
	send.text = "Отправить"
	send.disabled = not can_confirm()
	send.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	send.pressed.connect(confirm_order)
	actions.add_child(send)
	var close := Button.new()
	close.text = "Закрыть"
	close.pressed.connect(_close_editor)
	actions.add_child(close)
	_side.add_child(actions)


func _add_report() -> void:
	_add_heading("Сводка за сутки")
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_side.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(list)

	var lines: PackedStringArray = []
	for event in game.events:
		lines.append(SupplyText.describe_event(game, event))
	if game.day == 1:
		lines.append("Миссия началась. Назначьте грузовикам приказы и завершите ход.")
	elif lines.is_empty():
		lines.append("Без происшествий.")
	for line in lines:
		var label := Label.new()
		label.text = "• " + line
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.add_theme_font_size_override("font_size", 13)
		list.add_child(label)


func _show_result() -> void:
	var rules := game.rules
	var held := game.companies.size() - game.get_lost_count()
	_overlay_text.text = "%s\n\nУдержано участков: %d из %d\nГрузовиков уцелело: %d из %d\nПрошло суток: %d" % [
		"Миссия выполнена" if game.is_won() else "Миссия провалена",
		held, game.companies.size(),
		game.get_trucks_alive(), rules.truck_count,
		game.day - 1,
	]
	_overlay.show()


func _add_heading(text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 16)
	_side.add_child(label)


func _add_note(text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", SupplyMapView.COLOR_MUTED)
	_side.add_child(label)


func _flat(color: Color, margin_x: int, margin_y: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.content_margin_left = margin_x
	box.content_margin_right = margin_x
	box.content_margin_top = margin_y
	box.content_margin_bottom = margin_y
	return box
