extends Node2D

@onready var game_clock: GameClock = $GameClock


func _ready() -> void:
	_create_hud()


func _create_hud() -> void:
	var canvas := CanvasLayer.new()
	canvas.name = "HUD"
	add_child(canvas)

	var panel := PanelContainer.new()
	panel.position = Vector2(16, 16)
	panel.custom_minimum_size = Vector2(360, 84)
	canvas.add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)

	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 8)
	margin.add_child(layout)

	var date_label := Label.new()
	date_label.name = "DateLabel"
	date_label.text = game_clock.get_date_text()
	layout.add_child(date_label)

	var controls := HBoxContainer.new()
	controls.add_theme_constant_override("separation", 6)
	layout.add_child(controls)

	var speeds: Array[float] = [0.0, 1.0, 2.0, 4.0]
	var captions: Array[String] = ["Пауза", "×1", "×2", "×4"]
	for index in speeds.size():
		var button := Button.new()
		button.text = captions[index]
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(game_clock.set_speed.bind(speeds[index]))
		controls.add_child(button)

	var help := Label.new()
	help.text = "WASD/стрелки — камера  •  колёсико — масштаб  •  Space — пауза"
	help.position = Vector2(16, 690)
	help.add_theme_color_override("font_color", Color(0.9, 0.92, 0.86, 0.9))
	canvas.add_child(help)

	game_clock.time_changed.connect(
		func(_day: int, _hour: int, _minute: int) -> void:
			date_label.text = game_clock.get_date_text()
	)
	game_clock.speed_changed.connect(
		func(_speed: float) -> void:
			date_label.text = game_clock.get_date_text()
	)
