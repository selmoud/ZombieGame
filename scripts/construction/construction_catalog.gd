class_name ConstructionCatalog
extends RefCounted

const GROUPS := {
	"boundaries": {
		"label": "Границы",
		"tools": ["wall", "door", "barricade"],
	},
	"modules": {
		"label": "Модули",
		"tools": [],
	},
}

const TOOLS := {
	"wall": {
		"label": "Стена",
		"color": Color("c5c1b3"),
		"placement": "line",
		"required_item": "wall_section",
	},
	"door": {
		"label": "Дверь",
		"color": Color("b88752"),
		"placement": "single",
		"required_item": "door_module",
	},
	"barricade": {
		"label": "Баррикада",
		"color": Color("8f7558"),
		"placement": "line",
		"required_item": "debris",
	},
}


static func has_tool(tool_id: StringName) -> bool:
	return TOOLS.has(String(tool_id))


static func get_label(tool_id: StringName) -> String:
	if not has_tool(tool_id):
		return ""
	return TOOLS[String(tool_id)]["label"]


static func get_color(tool_id: StringName) -> Color:
	if not has_tool(tool_id):
		return Color.WHITE
	return TOOLS[String(tool_id)]["color"]


static func get_placement(tool_id: StringName) -> String:
	if not has_tool(tool_id):
		return ""
	return TOOLS[String(tool_id)]["placement"]


static func get_required_item(tool_id: StringName) -> StringName:
	if not has_tool(tool_id):
		return &""
	return StringName(TOOLS[String(tool_id)]["required_item"])
