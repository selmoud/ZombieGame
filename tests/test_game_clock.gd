extends SceneTree


func _init() -> void:
	var clock := GameClock.new()

	assert(clock.get_day() == 1)
	assert(clock.get_hour() == 8)
	assert(clock.get_minute() == 0)

	clock.total_minutes = GameClock.MINUTES_PER_DAY + 75
	assert(clock.get_day() == 2)
	assert(clock.get_hour() == 1)
	assert(clock.get_minute() == 15)

	clock.set_speed(4.0)
	assert(clock.speed == 4.0)
	clock.toggle_pause()
	assert(clock.speed == 0.0)
	clock.toggle_pause()
	assert(clock.speed == 4.0)

	print("GameClock tests passed")
	clock.free()
	quit()
