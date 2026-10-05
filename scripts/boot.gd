extends Control
## Placeholder start screen. Replace once the game concept is chosen.

@onready var _title: Label = %Title
@onready var _version: Label = %Version


func _ready() -> void:
	_title.text = ProjectSettings.get_setting("application/config/name")
	_version.text = "Godot %s" % Engine.get_version_info().string
