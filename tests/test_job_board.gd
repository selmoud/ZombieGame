extends SceneTree


func _init() -> void:
	var jobs := JobBoard.new()
	jobs.sync_construction_jobs([
		Vector2i(2, 2),
		Vector2i(8, 8),
		Vector2i(4, 3),
	])

	assert(jobs.get_construction_job_count() == 3)
	var claimed := jobs.claim_nearest_construction(10, Vector2i(3, 3))
	assert(claimed == Vector2i(4, 3))

	var second_claim := jobs.claim_nearest_construction(11, Vector2i(3, 3))
	assert(second_claim == Vector2i(2, 2))

	jobs.release_construction(claimed, 10)
	assert(jobs.claim_nearest_construction(12, Vector2i(4, 4)) == claimed)

	jobs.sync_construction_jobs([Vector2i(8, 8)])
	assert(jobs.get_construction_job_count() == 1)
	var available := jobs.get_available_construction_jobs(Vector2i.ZERO)
	assert(available == [Vector2i(8, 8)])
	assert(jobs.claim_construction(Vector2i(8, 8), 20))
	assert(not jobs.claim_construction(Vector2i(8, 8), 21))

	print("JobBoard tests passed")
	jobs.free()
	quit()
