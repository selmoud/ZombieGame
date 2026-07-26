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
		"footprint": Vector2i.ONE,
		"rotatable": false,
		"blocks_movement": true,
	},
	"door": {
		"label": "Дверь",
		"color": Color("b88752"),
		"placement": "single",
		"required_item": "door_module",
		"footprint": Vector2i.ONE,
		"rotatable": false,
		"blocks_movement": false,
	},
	"barricade": {
		"label": "Баррикада",
		"color": Color("8f7558"),
		"placement": "line",
		"required_item": "debris",
		"footprint": Vector2i.ONE,
		"rotatable": false,
		"blocks_movement": true,
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


static func get_footprint(
	tool_id: StringName,
	rotation_quarters: int = 0
) -> Vector2i:
	if not has_tool(tool_id):
		return Vector2i.ZERO
	var footprint: Vector2i = TOOLS[String(tool_id)].get(
		"footprint",
		Vector2i.ONE
	)
	if posmod(rotation_quarters, 2) == 1:
		return Vector2i(footprint.y, footprint.x)
	return footprint


static func get_occupied_cells(
	tool_id: StringName,
	anchor: Vector2i,
	rotation_quarters: int = 0
) -> Array[Vector2i]:
	return get_cells_for_footprint(
		get_footprint(tool_id),
		anchor,
		rotation_quarters
	)


static func get_cells_for_footprint(
	footprint: Vector2i,
	anchor: Vector2i,
	rotation_quarters: int = 0
) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var rotated_footprint := (
		Vector2i(footprint.y, footprint.x)
		if posmod(rotation_quarters, 2) == 1
		else footprint
	)
	for y in range(rotated_footprint.y):
		for x in range(rotated_footprint.x):
			result.append(anchor + Vector2i(x, y))
	return result


static func is_rotatable(tool_id: StringName) -> bool:
	return (
		has_tool(tool_id)
		and bool(TOOLS[String(tool_id)].get("rotatable", false))
	)


static func blocks_movement(tool_id: StringName) -> bool:
	return (
		has_tool(tool_id)
		and bool(TOOLS[String(tool_id)].get("blocks_movement", false))
	)
