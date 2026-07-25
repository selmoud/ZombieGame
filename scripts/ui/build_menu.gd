class_name BuildMenu
extends Control

signal zone_tool_selected(tool_id: StringName)
signal construction_tool_selected(tool_id: StringName)
signal cancel_tool_selected

const CATEGORY_LABELS := {
	"construction": "Строительство",
	"zones": "Зоны",
	"furniture": "Мебель",
}

var _selected_category := "zones"
var _selected_zone_group := "blocks"
var _selected_construction_group := "boundaries"
var _category_buttons: Dictionary[String, Button] = {}
var _group_buttons: Dictionary[String, Button] = {}
var _tool_buttons: Dictionary[StringName, Button] = {}
var _active_tool: StringName = &""
var _menu_panel: PanelContainer
var _groups_row: HBoxContainer
var _tools_row: HBoxContainer
var _status_label: Label
var _cursor_indicator: PanelContainer
var _cursor_label: Label


func _ready() -> void:
	_build_interface()
	_show_category("zones")


func _process(_delta: float) -> void:
	_update_cursor_indicator()


func sync_active_tool(tool_id: StringName) -> void:
	_active_tool = tool_id
	for id: StringName in _tool_buttons:
		_tool_buttons[id].button_pressed = id == tool_id
	if tool_id.is_empty():
		_status_label.text = "Инструмент не выбран"
		_cursor_indicator.hide()
	elif tool_id == ZoneManager.ERASE_TOOL:
		_status_label.text = "Ластик  •  ЛКМ удалить  •  Esc отмена"
		_cursor_label.text = "×  Удаление зоны"
		_cursor_label.add_theme_color_override("font_color", Color("e36b63"))
	else:
		_status_label.text = "%s  •  ЛКМ выделить  •  ПКМ удалить  •  Esc отмена" % ZoneCatalog.get_label(tool_id)
		_cursor_label.text = "■  %s" % ZoneCatalog.get_label(tool_id)
		_cursor_label.add_theme_color_override("font_color", ZoneCatalog.get_color(tool_id).lightened(0.22))


func sync_construction_tool(tool_id: StringName) -> void:
	_active_tool = tool_id
	for id: StringName in _tool_buttons:
		_tool_buttons[id].button_pressed = id == tool_id
	if tool_id.is_empty():
		_status_label.text = "Инструмент не выбран"
		_cursor_indicator.hide()
	elif tool_id == ConstructionManager.ERASE_TOOL:
		_status_label.text = "Удаление чертежей  •  ЛКМ удалить  •  Esc отмена"
		_cursor_label.text = "×  Удаление чертежей"
		_cursor_label.add_theme_color_override("font_color", Color("e36b63"))
	else:
		_status_label.text = "%s  •  ЛКМ разместить  •  ПКМ удалить  •  Esc отмена" % ConstructionCatalog.get_label(tool_id)
		_cursor_label.text = "◇  %s (чертёж)" % ConstructionCatalog.get_label(tool_id)
		_cursor_label.add_theme_color_override(
			"font_color",
			ConstructionCatalog.get_color(tool_id).lightened(0.18)
		)


func _build_interface() -> void:
	var panel := PanelContainer.new()
	_menu_panel = panel
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

	_build_cursor_indicator()


func _build_cursor_indicator() -> void:
	_cursor_indicator = PanelContainer.new()
	_cursor_indicator.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cursor_indicator.z_index = 10
	_cursor_indicator.hide()
	add_child(_cursor_indicator)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.055, 0.06, 0.052, 0.94)
	style.border_color = Color(0.36, 0.39, 0.34, 0.9)
	style.set_border_width_all(1)
	style.set_corner_radius_all(4)
	style.content_margin_left = 8
	style.content_margin_top = 5
	style.content_margin_right = 8
	style.content_margin_bottom = 5
	_cursor_indicator.add_theme_stylebox_override("panel", style)

	_cursor_label = Label.new()
	_cursor_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cursor_indicator.add_child(_cursor_label)


func _update_cursor_indicator() -> void:
	if _active_tool.is_empty():
		_cursor_indicator.hide()
		return

	var hovered_control := get_viewport().gui_get_hovered_control()
	if hovered_control != null and (
		hovered_control == _menu_panel or _menu_panel.is_ancestor_of(hovered_control)
	):
		_cursor_indicator.hide()
		return

	_cursor_indicator.show()
	_cursor_indicator.reset_size()
	var viewport_size := get_viewport_rect().size
	var desired_position := get_viewport().get_mouse_position() + Vector2(14, 20)
	desired_position.x = minf(
		desired_position.x,
		viewport_size.x - _cursor_indicator.size.x - 8.0
	)
	desired_position.y = minf(
		desired_position.y,
		viewport_size.y - _cursor_indicator.size.y - 8.0
	)
	_cursor_indicator.position = desired_position


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
			_show_construction_groups()
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
	_show_zone_tools(
		_selected_zone_group if ZoneCatalog.GROUPS.has(_selected_zone_group) else "blocks"
	)


func _show_zone_tools(group_id: String) -> void:
	cancel_tool_selected.emit()
	_selected_zone_group = group_id
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


func _show_construction_groups() -> void:
	var group := ButtonGroup.new()
	for group_id: String in ConstructionCatalog.GROUPS:
		var definition: Dictionary = ConstructionCatalog.GROUPS[group_id]
		var button := _make_toggle_button(definition["label"], group)
		button.pressed.connect(_show_construction_tools.bind(group_id))
		_groups_row.add_child(button)
		_group_buttons[group_id] = button
	_show_construction_tools(
		_selected_construction_group
		if ConstructionCatalog.GROUPS.has(_selected_construction_group)
		else "boundaries"
	)


func _show_construction_tools(group_id: String) -> void:
	cancel_tool_selected.emit()
	_selected_construction_group = group_id
	_group_buttons[group_id].button_pressed = true
	_clear_row(_tools_row)
	_tool_buttons.clear()

	var definition: Dictionary = ConstructionCatalog.GROUPS[group_id]
	var tools: Array = definition["tools"]
	if tools.is_empty():
		var hint := Label.new()
		hint.text = "Модульные постройки появятся на следующих этапах"
		hint.add_theme_color_override("font_color", Color(0.7, 0.72, 0.68))
		_tools_row.add_child(hint)
		return

	var tool_group := ButtonGroup.new()
	for tool_id: String in tools:
		var button := _make_toggle_button(ConstructionCatalog.get_label(tool_id), tool_group)
		button.pressed.connect(_select_construction_tool.bind(StringName(tool_id)))
		_tools_row.add_child(button)
		_tool_buttons[StringName(tool_id)] = button

	var eraser := _make_toggle_button("Удалить чертёж", tool_group)
	eraser.pressed.connect(_select_construction_tool.bind(ConstructionManager.ERASE_TOOL))
	_tools_row.add_child(eraser)
	_tool_buttons[ConstructionManager.ERASE_TOOL] = eraser


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


func _select_construction_tool(tool_id: StringName) -> void:
	construction_tool_selected.emit(tool_id)


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
