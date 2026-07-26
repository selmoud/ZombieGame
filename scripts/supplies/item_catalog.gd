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
	"cardboard_bed": {
		"label": "Картон",
		"color": Color("a98256"),
		"furniture": true,
	},
	"sleeping_bag": {
		"label": "Спальные мешки",
		"color": Color("71855c"),
		"furniture": true,
	},
	"single_bed": {
		"label": "Кровати",
		"color": Color("7393a8"),
		"furniture": true,
	},
	"bunk_bed": {
		"label": "Двухъярусные кровати",
		"color": Color("58778c"),
		"furniture": true,
	},
	"toilet": {
		"label": "Туалеты",
		"color": Color("d7ddd8"),
		"furniture": true,
	},
	"food_table": {
		"label": "Столы раздачи",
		"color": Color("a56d46"),
		"furniture": true,
	},
}


static func get_label(item_id: StringName) -> String:
	return ITEMS.get(String(item_id), {}).get("label", String(item_id))


static func get_color(item_id: StringName) -> Color:
	return ITEMS.get(String(item_id), {}).get("color", Color.WHITE)


static func is_furniture(item_id: StringName) -> bool:
	return bool(ITEMS.get(String(item_id), {}).get("furniture", false))
