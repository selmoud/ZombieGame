class_name BattleScreen
extends Control
## The mission screen: map, time controls, selected unit, purchases and the radio log.
## All rules live in Battle; this script shows its state and passes orders to it.

const BAR_HEIGHT := 48
const SPEEDS: Array[float] = [1.0, 2.0, 4.0]
const RADIO_LINES := 60

const COLOR_BACKGROUND := Color("0a1626")
const COLOR_PANEL := Color("0f2236")
const COLOR_TEXT := Color("eaf2fb")
const COLOR_MUTED := Color("8aa5bf")
const COLOR_ALARM := Color("ff8f86")
const COLOR_BUTTON := Color("173450")
const COLOR_BUTTON_HOVER := Color("21486c")
const COLOR_LINE := Color("2a5578")
const MAP_SIZE := Vector2(960, 672)
const PAN_KEYS: Dictionary[Key, Vector2] = {
	KEY_LEFT: Vector2.LEFT, KEY_A: Vector2.LEFT, KEY_RIGHT: Vector2.RIGHT, KEY_D: Vector2.RIGHT,
	KEY_UP: Vector2.UP, KEY_W: Vector2.UP, KEY_DOWN: Vector2.DOWN, KEY_S: Vector2.DOWN,
}

var battle: Battle
var paused := true
var speed := 1.0

var _map: BattleMapView
var _status: Label
var _pause_button: Button
var _speed_buttons: Array[Button] = []
var _unit_title: Label
var _unit_details: Label
var _retreat_button: Button
var _hold_button: Button
var _disembark_button: Button
var _buy_buttons: Array[Button] = []
var _strike_button: Button
var _radio: VBoxContainer
var _radio_scroll: ScrollContainer
var _overlay: PanelContainer
var _overlay_text: Label
var _shown_events := 0


func _ready() -> void:
	_build_layout()
	start_mission(randi())


func _process(delta: float) -> void:
	if battle == null:
		return
	if not paused:
		battle.advance(delta * speed)
	var push := Vector2.ZERO
	for key: Key in PAN_KEYS:
		if Input.is_key_pressed(key):
			push += PAN_KEYS[key]
	if push != Vector2.ZERO:
		_map.pan(push * BattleMapView.PAN_SPEED * delta)
	_refresh()


func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or key.echo:
		return
	match key.keycode:
		KEY_SPACE:
			toggle_pause()
		KEY_1:
			set_speed(SPEEDS[0])
		KEY_2:
			set_speed(SPEEDS[1])
		KEY_3:
			set_speed(SPEEDS[2])
		KEY_ESCAPE:
			set_strike_mode(false)
			select_unit(-1)
		_:
			return
	accept_event()


func start_mission(seed_value: int) -> void:
	battle = Battle.new(seed_value)
	paused = true
	speed = 1.0
	_shown_events = 0
	for child in _radio.get_children():
		child.queue_free()
	_map.set_battle(battle)
	_map.selected_unit = -1
	_map.strike_mode = false
	_overlay.hide()
	_add_radio_line("Штаб: наберите группу и снимите паузу (пробел).", false)
	_refresh()


func toggle_pause() -> void:
	if battle.result == Battle.Result.ONGOING:
		paused = not paused


func set_speed(value: float) -> void:
	speed = value


func select_unit(unit_id: int) -> void:
	var unit := battle.get_unit(unit_id)
	var valid := unit != null and unit.side == BattleUnit.Side.PLAYER and unit.alive
	_map.selected_unit = unit_id if valid else -1


func get_selected_unit() -> BattleUnit:
	var unit := battle.get_unit(_map.selected_unit)
	return unit if unit != null and unit.alive else null


func buy(kind: UnitKind.Type) -> bool:
	return battle.buy_unit(kind)


func set_strike_mode(enabled: bool) -> void:
	_map.strike_mode = enabled and battle.can_strike()
	_strike_button.set_pressed_no_signal(_map.strike_mode)


## Left click selects a unit or places an armed strike; right click orders the selected
## unit: board a carrier, take an objective or move, depending on what is under the cursor.
func click_map(position: Vector2, button: MouseButton) -> void:
	if battle.result != Battle.Result.ONGOING:
		return
	if button == MOUSE_BUTTON_LEFT:
		if _map.strike_mode:
			battle.call_strike(position)
			set_strike_mode(false)
		else:
			select_unit(_map.unit_at(position))
		return

	if _map.strike_mode:
		set_strike_mode(false)
		return
	var unit := get_selected_unit()
	if unit == null:
		return
	# Orders to a squad riding in a carrier go to the carrier.
	if unit.carrier >= 0:
		unit = battle.units[unit.carrier]
	if Input.is_key_pressed(KEY_SHIFT):
		battle.order_face(unit.id, position)
		return
	var clicked := battle.get_unit(_map.unit_at(position))
	if clicked != null and clicked.id != unit.id and battle.order_embark(unit.id, clicked.id):
		return
	var objective := _map.objective_at(position)
	if objective >= 0:
		battle.order_capture(unit.id, objective)
	else:
		battle.order_move(unit.id, Vector2i(position.floor()))


func is_result_shown() -> bool:
	return _overlay.visible


func _build_layout() -> void:
	theme = _make_theme()
	var background := ColorRect.new()
	background.color = COLOR_BACKGROUND
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)

	var bar := PanelContainer.new()
	bar.add_theme_stylebox_override("panel", _flat(COLOR_PANEL, 14, 6))
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.offset_bottom = BAR_HEIGHT
	add_child(bar)
	var bar_row := HBoxContainer.new()
	bar_row.add_theme_constant_override("separation", 10)
	bar.add_child(bar_row)
	var title := Label.new()
	title.text = "Контакт"
	title.add_theme_font_size_override("font_size", 20)
	bar_row.add_child(title)
	_status = Label.new()
	_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_status.add_theme_color_override("font_color", COLOR_MUTED)
	_status.add_theme_font_size_override("font_size", 15)
	bar_row.add_child(_status)
	_pause_button = Button.new()
	_pause_button.custom_minimum_size = Vector2(130, 0)
	_pause_button.focus_mode = Control.FOCUS_NONE
	_pause_button.pressed.connect(toggle_pause)
	bar_row.add_child(_pause_button)
	for value in SPEEDS:
		var button := Button.new()
		button.text = "×%d" % int(value)
		button.toggle_mode = true
		button.focus_mode = Control.FOCUS_NONE
		button.custom_minimum_size = Vector2(40, 0)
		button.pressed.connect(set_speed.bind(value))
		bar_row.add_child(button)
		_speed_buttons.append(button)

	_map = BattleMapView.new()
	_map.position = Vector2(0, BAR_HEIGHT)
	_map.size = MAP_SIZE
	_map.map_clicked.connect(click_map)
	add_child(_map)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _flat(COLOR_PANEL, 12, 10))
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 960
	panel.offset_top = BAR_HEIGHT
	add_child(panel)
	var side := VBoxContainer.new()
	side.add_theme_constant_override("separation", 6)
	panel.add_child(side)

	_unit_title = _heading(side, "")
	_unit_title.add_theme_font_size_override("font_size", 16)
	_unit_title.add_theme_color_override("font_color", COLOR_TEXT)
	_unit_details = Label.new()
	_unit_details.add_theme_font_size_override("font_size", 13)
	_unit_details.add_theme_color_override("font_color", COLOR_MUTED)
	_unit_details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_unit_details.custom_minimum_size = Vector2(0, 96)
	side.add_child(_unit_details)
	var orders := HBoxContainer.new()
	side.add_child(orders)
	_hold_button = _button(orders, "Стоять", func() -> void: battle.order_hold(_ordered_unit()))
	_retreat_button = _button(orders, "Отойти", func() -> void: battle.order_retreat(_ordered_unit()))
	_disembark_button = _button(orders, "Спешить", func() -> void: battle.order_disembark(_ordered_unit()))

	side.add_child(HSeparator.new())
	_heading(side, "Пополнение и поддержка")
	var shop := HBoxContainer.new()
	side.add_child(shop)
	for kind: UnitKind.Type in UnitKind.Type.values():
		var text := "%s\n%d" % [BattleText.KIND_SHORT[kind], UnitKind.COST[kind]]
		var button := _button(shop, text, buy.bind(kind))
		button.tooltip_text = BattleText.KIND_TITLES[kind]
		# Icon on top, name and price under it, so three buttons fit side by side.
		button.icon = BattleIcons.own(kind)
		button.add_theme_constant_override("icon_max_width", 30)
		button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		button.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		button.clip_text = true
		button.add_theme_font_size_override("font_size", 11)
		_buy_buttons.append(button)
	_strike_button = Button.new()
	_strike_button.toggle_mode = true
	_strike_button.focus_mode = Control.FOCUS_NONE
	_strike_button.add_theme_font_size_override("font_size", 13)
	_strike_button.toggled.connect(set_strike_mode)
	side.add_child(_strike_button)

	side.add_child(HSeparator.new())
	_heading(side, "Радио")
	_radio_scroll = ScrollContainer.new()
	_radio_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_radio_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	side.add_child(_radio_scroll)
	_radio = VBoxContainer.new()
	_radio.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_radio.add_theme_constant_override("separation", 3)
	_radio_scroll.add_child(_radio)

	_overlay = PanelContainer.new()
	_overlay.add_theme_stylebox_override("panel", _framed(COLOR_PANEL, 40, 30))
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
	_button(overlay_box, "Новая миссия", func() -> void: start_mission(randi()))


## Unit that takes the buttons' orders: the carrier when the selected squad rides in one.
func _ordered_unit() -> int:
	var unit := get_selected_unit()
	if unit == null:
		return -1
	return unit.carrier if unit.carrier >= 0 else unit.id


func _refresh() -> void:
	var rules := battle.rules
	var held := battle.count_held(BattleUnit.Side.PLAYER)
	_status.text = "%s / %s    Ресурсы: %d    Объекты: %d из %d    Удержание: %s / %s" % [
		BattleText.clock(battle.time), BattleText.clock(rules.mission_time),
		int(battle.funds), held, battle.map.objectives.size(),
		BattleText.clock(battle.hold_time), BattleText.clock(rules.hold_to_win),
	]
	_pause_button.text = "Продолжить" if paused else "Пауза"
	for i in SPEEDS.size():
		_speed_buttons[i].set_pressed_no_signal(is_equal_approx(speed, SPEEDS[i]))

	var unit := get_selected_unit()
	if unit == null:
		_map.selected_unit = -1
		_unit_title.text = "Отряд не выбран"
		_unit_details.text = (
			"ЛКМ — выбрать. ПКМ — идти; по объекту — занять; по БТР — погрузка.\n"
			+ "Shift+ПКМ — куда смотреть: туда разведка идёт первой.\n"
			+ "Колесо — масштаб, средняя кнопка или WASD — сдвиг."
		)
	else:
		_unit_title.text = "%s — %s" % [unit.call_sign, BattleText.KIND_TITLES[unit.kind].to_lower()]
		var scouting := "вся округа разведана"
		if unit.carrier >= 0:
			scouting = "в десанте не ведётся"
		elif not unit.scout_queue.is_empty():
			scouting = "гекс %s, %d%%; осталось гексов: %d" % [
				HexGrid.title(unit.scout_queue[0]), roundi(battle.scout_progress(unit) * 100.0),
				unit.scout_queue.size(),
			]
		var lines: PackedStringArray = [
			"Состав: %d из %d" % [unit.strength, unit.max_strength()],
			"Разведка: %s" % scouting,
			"Задача: %s" % BattleText.order_title(battle, unit),
			"Местность: %s, гекс %s" % [
				BattleText.TERRAIN_TITLES[battle.map.terrain_at(unit.position)],
				battle.hex_title(unit.position),
			],
		]
		if unit.passenger >= 0:
			lines.append("Десант: %s" % battle.units[unit.passenger].call_sign)
		_unit_details.text = "\n".join(lines)
	var carrier := battle.get_unit(_ordered_unit())
	_hold_button.disabled = carrier == null
	_retreat_button.disabled = carrier == null
	_disembark_button.disabled = carrier == null or carrier.passenger < 0

	for kind: UnitKind.Type in UnitKind.Type.values():
		_buy_buttons[kind].disabled = not battle.can_buy(kind)
	_strike_button.disabled = not battle.can_strike()
	_strike_button.text = "Артудар — %d (затем ЛКМ по карте)" % int(rules.strike_cost)
	if _strike_button.disabled and _map.strike_mode:
		set_strike_mode(false)

	while _shown_events < battle.events.size():
		var event := battle.events[_shown_events]
		_shown_events += 1
		var text := BattleText.describe_event(battle, event)
		if not text.is_empty():
			_add_radio_line("%s  %s" % [BattleText.clock(event.time), text], BattleText.is_alarm(event))

	_map.queue_redraw()
	if battle.result != Battle.Result.ONGOING and not _overlay.visible:
		_show_result()


func _add_radio_line(text: String, alarm: bool) -> void:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.add_theme_font_size_override("font_size", 13)
	if alarm:
		label.add_theme_color_override("font_color", COLOR_ALARM)
	_radio.add_child(label)
	if _radio.get_child_count() > RADIO_LINES:
		_radio.get_child(0).queue_free()
	# The new line has no size yet; scroll to it once the layout has settled.
	_scroll_radio.call_deferred()


func _scroll_radio() -> void:
	await get_tree().process_frame
	_radio_scroll.scroll_vertical = int(_radio_scroll.get_v_scroll_bar().max_value)


func _show_result() -> void:
	paused = true
	_overlay_text.text = "%s\n\nВремя: %s\nОбъектов удержано: %d из %d\nОтрядов в строю: %d" % [
		"Задача выполнена" if battle.result == Battle.Result.WON else "Задача провалена",
		BattleText.clock(battle.time),
		battle.count_held(BattleUnit.Side.PLAYER), battle.map.objectives.size(),
		battle.count_units(BattleUnit.Side.PLAYER),
	]
	_overlay.show()


func _heading(parent: Control, text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", COLOR_MUTED)
	parent.add_child(label)
	return label


func _button(parent: Control, text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.focus_mode = Control.FOCUS_NONE
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.add_theme_font_size_override("font_size", 13)
	button.pressed.connect(action)
	parent.add_child(button)
	return button


func _flat(color: Color, margin_x: int, margin_y: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.content_margin_left = margin_x
	box.content_margin_right = margin_x
	box.content_margin_top = margin_y
	box.content_margin_bottom = margin_y
	return box


## A surface with a dark edge, like the windows of a staff planning tool.
func _framed(color: Color, margin_x: int, margin_y: int, edge: Color = COLOR_LINE) -> StyleBoxFlat:
	var box := _flat(color, margin_x, margin_y)
	box.border_color = edge
	box.set_border_width_all(1)
	box.set_corner_radius_all(3)
	return box


func _make_theme() -> Theme:
	var result := Theme.new()
	result.set_color("font_color", "Label", COLOR_TEXT)
	result.set_stylebox("normal", "Button", _framed(COLOR_BUTTON, 10, 5))
	result.set_stylebox("hover", "Button", _framed(COLOR_BUTTON_HOVER, 10, 5, COLOR_TEXT))
	result.set_stylebox("pressed", "Button", _framed(Color("4fb0ff"), 10, 5))
	result.set_stylebox("disabled", "Button", _framed(Color(COLOR_BUTTON, 0.35), 10, 5))
	result.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	result.set_color("font_color", "Button", COLOR_TEXT)
	result.set_color("font_hover_color", "Button", Color.WHITE)
	result.set_color("font_pressed_color", "Button", COLOR_BACKGROUND)
	result.set_color("font_hover_pressed_color", "Button", COLOR_BACKGROUND)
	result.set_color("font_disabled_color", "Button", Color(COLOR_MUTED, 0.5))
	var line := StyleBoxLine.new()
	line.color = COLOR_LINE
	line.thickness = 1
	result.set_stylebox("separator", "HSeparator", line)
	return result
