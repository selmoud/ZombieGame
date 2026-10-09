class_name BattleIcons
extends RefCounted
## The owner's unit icons: which picture stands for which unit on which side.
## Icons for units the game does not have yet are in assets/icons/ as well.

const FOLDER := "res://assets/icons/"
## Own units, by UnitKind.Type.
const OWN: PackedStringArray = ["rifle", "sniper", "apc"]
## Identified enemy contacts, by UnitKind.Type. The eastern set has no scout of its
## own, so an enemy scout is shown with the same sight mark as ours, in enemy colour.
const HOSTILE: PackedStringArray = ["east_rifle", "sniper", "east_jeep"]

static var _cache: Dictionary[String, Texture2D] = {}


static func own(kind: int) -> Texture2D:
	return _load(OWN[kind])


static func hostile(kind: int) -> Texture2D:
	return _load(HOSTILE[kind])


static func _load(name: String) -> Texture2D:
	if not _cache.has(name):
		_cache[name] = load(FOLDER + name + ".png")
	return _cache[name]
