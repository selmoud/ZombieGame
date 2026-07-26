class_name ItemCatalog
extends RefCounted

const ITEMS := {
	"wall_section": {
		"label": "Секции стен",
		"color": Color("c5c1b3"),
	},
	"door_module": {
		"label": "Двери",
		"color": Color("b88752"),
	},
	"debris": {
		"label": "Обломки",
		"color": Color("8f7558"),
	},
}


static func get_label(item_id: StringName) -> String:
	return ITEMS.get(String(item_id), {}).get("label", String(item_id))


static func get_color(item_id: StringName) -> Color:
	return ITEMS.get(String(item_id), {}).get("color", Color.WHITE)
