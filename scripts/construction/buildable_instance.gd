class_name BuildableInstance
extends RefCounted

var object_id: StringName
var anchor: Vector2i
var rotation_quarters: int
var occupied_cells: Array[Vector2i]


func _init(
	p_object_id: StringName,
	p_anchor: Vector2i,
	p_rotation_quarters: int = 0
) -> void:
	object_id = p_object_id
	anchor = p_anchor
	rotation_quarters = posmod(p_rotation_quarters, 4)
	occupied_cells = ConstructionCatalog.get_occupied_cells(
		object_id,
		anchor,
		rotation_quarters
	)


func occupies(cell: Vector2i) -> bool:
	return cell in occupied_cells
