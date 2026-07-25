class_name GameClock
extends Node

signal time_changed(day: int, hour: int, minute: int)
signal speed_changed(speed: float)

const MINUTES_PER_DAY := 24 * 60
const GAME_MINUTES_PER_REAL_SECOND := 2.0
const AVAILABLE_SPEEDS: Array[float] = [0.0, 1.0, 2.0, 4.0]

var speed := 1.0
var total_minutes := 8.0 * 60.0
var _previous_displayed_minute := -1
var _speed_before_pause := 1.0


func _ready() -> void:
	_emit_time_if_changed()


func _process(delta: float) -> void:
	if speed > 0.0:
		total_minutes += delta * GAME_MINUTES_PER_REAL_SECOND * speed
		_emit_time_if_changed()


func _unhandled_key_input(event: InputEvent) -> void:
	if not event.is_pressed() or event.is_echo():
		return

	match event.keycode:
		KEY_SPACE:
			toggle_pause()
		KEY_1:
			set_speed(1.0)
		KEY_2:
			set_speed(2.0)
		KEY_3, KEY_4:
			set_speed(4.0)


func set_speed(value: float) -> void:
	if value not in AVAILABLE_SPEEDS:
		return
	if value > 0.0:
		_speed_before_pause = value
	speed = value
	speed_changed.emit(speed)


func toggle_pause() -> void:
	if speed == 0.0:
		set_speed(_speed_before_pause)
	else:
		set_speed(0.0)


func get_day() -> int:
	return int(total_minutes / MINUTES_PER_DAY) + 1


func get_hour() -> int:
	return int((int(total_minutes) % MINUTES_PER_DAY) / 60)


func get_minute() -> int:
	return int(total_minutes) % 60


func get_date_text() -> String:
	return "День %d  •  %02d:%02d  •  скорость %s" % [
		get_day(),
		get_hour(),
		get_minute(),
		_format_speed(),
	]


func _format_speed() -> String:
	if speed == 0.0:
		return "пауза"
	return "×%d" % int(speed)


func _emit_time_if_changed() -> void:
	var displayed_minute := int(total_minutes)
	if displayed_minute == _previous_displayed_minute:
		return
	_previous_displayed_minute = displayed_minute
	time_changed.emit(get_day(), get_hour(), get_minute())
