class_name BuildMenu
extends Control

signal zone_tool_selected(tool_id: StringName)
signal cancel_tool_selected

const CATEGORY_LABELS := {
	"construction": "Строительство",
	"zones": "Зоны",
	"furniture": "Мебель",
}

var _selected_category := "zones"
var _selected_group := "blocks"
var _category_buttons: Dictionary[String, Button] = {}
var _group_buttons: Dictionary[String, Button] = {}
var _tool_buttons: Dictionary[StringName, Button] = {}
var _groups_row: HBoxContainer
var _tools_row: HBoxContainer
var _status_label: Label


func _ready() -> void:
	_build_interface()
	_show_category("zones")


func sync_active_tool(tool_id: StringName) -> void:
	for id: StringName in _tool_buttons:
		_tool_buttons[id].button_pressed = id == tool_id
	if tool_id.is_empty():
		_status_label.text = "Инструмент не выбран"
	elif tool_id == ZoneManager.ERASE_TOOL:
		_status_label.text = "Ластик  •  ЛКМ удалить  •  Esc отмена"
	else:
		_status_label.text = "%s  •  ЛКМ выделить  •  ПКМ удалить  •  Esc отмена" % ZoneCatalog.get_label(tool_id)


func _build_interface() -> void:
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	panel.position = Vector2(-510, -160)
	panel.size = Vector2(1020, 148)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(panel)

	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.075, 0.085, 0.075, 0.96)
	panel_style.border_color = Color(0.32, 0.36, 0.3)
	panel_style.set_border_width_all(1)
	panel_style.set_corner_radius_all(5)
	panel.add_theme_stylebox_override("panel", panel_style)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 8)
	panel.add_child(margin)

	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 5)
	margin.add_child(layout)

	var categories_row := HBoxContainer.new()
	categories_row.add_theme_constant_override("separation", 6)
	layout.add_child(categories_row)

	var category_group := ButtonGroup.new()
	for category_id: String in CATEGORY_LABELS:
		var button := _make_toggle_button(CATEGORY_LABELS[category_id], category_group)
		button.pressed.connect(_show_category.bind(category_id))
		categories_row.add_child(button)
		_category_buttons[category_id] = button

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	categories_row.add_child(spacer)

	_status_label = Label.new()
	_status_label.text = "Инструмент не выбран"
	_status_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	categories_row.add_child(_status_label)

	var cancel_button := Button.new()
	cancel_button.text = "Отмена"
	cancel_button.focus_mode = Control.FOCUS_NONE
	cancel_button.pressed.connect(
		func() -> void:
			cancel_tool_selected.emit()
	)
	categories_row.add_child(cancel_button)

	_groups_row = HBoxContainer.new()
	_groups_row.add_theme_constant_override("separation", 6)
	layout.add_child(_groups_row)

	_tools_row = HBoxContainer.new()
	_tools_row.add_theme_constant_override("separation", 6)
	layout.add_child(_tools_row)


func _show_category(category_id: String) -> void:
	_selected_category = category_id
	_category_buttons[category_id].button_pressed = true
	_clear_row(_groups_row)
	_clear_row(_tools_row)
	_group_buttons.clear()
	_tool_buttons.clear()
	cancel_tool_selected.emit()

	match category_id:
		"zones":
			_show_zone_groups()
		"construction":
			_show_placeholder_groups({
				"boundaries": "Границы",
				"modules": "Модули",
			})
		"furniture":
			_show_placeholder_groups({
				"residential": "Жилое",
				"service": "Служебное",
				"security": "Безопасность",
			})


func _show_zone_groups() -> void:
	var group := ButtonGroup.new()
	for group_id: String in ZoneCatalog.GROUPS:
		var definition: Dictionary = ZoneCatalog.GROUPS[group_id]
		var button := _make_toggle_button(definition["label"], group)
		button.pressed.connect(_show_zone_tools.bind(group_id))
		_groups_row.add_child(button)
		_group_buttons[group_id] = button
	_show_zone_tools(_selected_group if ZoneCatalog.GROUPS.has(_selected_group) else "blocks")


func _show_zone_tools(group_id: String) -> void:
	cancel_tool_selected.emit()
	_selected_group = group_id
	_group_buttons[group_id].button_pressed = true
	_clear_row(_tools_row)
	_tool_buttons.clear()

	var tool_group := ButtonGroup.new()
	var definition: Dictionary = ZoneCatalog.GROUPS[group_id]
	for zone_id: String in definition["zones"]:
		var button := _make_toggle_button(ZoneCatalog.get_label(zone_id), tool_group)
		button.pressed.connect(_select_zone_tool.bind(StringName(zone_id)))
		_tools_row.add_child(button)
		_tool_buttons[StringName(zone_id)] = button

	var eraser := _make_toggle_button("Ластик", tool_group)
	eraser.pressed.connect(_select_zone_tool.bind(ZoneManager.ERASE_TOOL))
	_tools_row.add_child(eraser)
	_tool_buttons[ZoneManager.ERASE_TOOL] = eraser


func _show_placeholder_groups(groups: Dictionary) -> void:
	for label: String in groups.values():
		var button := Button.new()
		button.text = label
		button.disabled = true
		button.tooltip_text = "Будет доступно на следующем этапе"
		_groups_row.add_child(button)
	var hint := Label.new()
	hint.text = "Инструменты этого раздела появятся на следующих этапах"
	hint.add_theme_color_override("font_color", Color(0.7, 0.72, 0.68))
	_tools_row.add_child(hint)


func _select_zone_tool(tool_id: StringName) -> void:
	zone_tool_selected.emit(tool_id)


func _make_toggle_button(caption: String, group: ButtonGroup) -> Button:
	var button := Button.new()
	button.text = caption
	button.toggle_mode = true
	button.button_group = group
	button.focus_mode = Control.FOCUS_NONE
	return button


func _clear_row(row: Container) -> void:
	for child in row.get_children():
		row.remove_child(child)
		child.queue_free()
