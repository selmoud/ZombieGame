class_name ZoneCatalog
extends RefCounted

const GROUPS := {
	"blocks": {
		"label": "Блоки содержания",
		"zones": ["residential", "quarantine"],
	},
	"service": {
		"label": "Служебные",
		"zones": ["staff", "storage"],
	},
	"security": {
		"label": "Безопасность",
		"zones": ["elimination"],
	},
}

const ZONES := {
	"residential": {
		"label": "Жилой блок",
		"color": Color("4b9b68"),
	},
	"quarantine": {
		"label": "Карантин",
		"color": Color("d5a642"),
	},
	"staff": {
		"label": "Зона персонала",
		"color": Color("4f82b8"),
	},
	"storage": {
		"label": "Склад",
		"color": Color("9674b5"),
	},
	"elimination": {
		"label": "Зона ликвидации",
		"color": Color("b64e4e"),
	},
}


static func has_zone(zone_id: StringName) -> bool:
	return ZONES.has(String(zone_id))


static func get_label(zone_id: StringName) -> String:
	if not has_zone(zone_id):
		return ""
	return ZONES[String(zone_id)]["label"]


static func get_color(zone_id: StringName) -> Color:
	if not has_zone(zone_id):
		return Color.WHITE
	return ZONES[String(zone_id)]["color"]
