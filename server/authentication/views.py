import random
from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from .models import Song

REQUIRED_ROUNDS = 3
LOCKOUT_MINUTES = 5


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"detail": "CSRF cookie set"})


@require_POST
def login_view(request):
    username = request.POST.get("username")
    password = request.POST.get("password")

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    login(request, user)
    return JsonResponse({"status": "logged_in"})


@csrf_exempt
@require_POST
def start_2fa(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Auth required"}, status=401)

    # Lock check
    lock_until = request.session.get("lock_until")
    if lock_until:
        lock_time = timezone.datetime.fromisoformat(lock_until)
        if timezone.now() < lock_time:
            remaining = int((lock_time - timezone.now()).total_seconds())
            return JsonResponse({
                "error": "Account locked",
                "remaining": remaining
            }, status=403)

    request.session["2fa"] = {
        "round": 0,
        "any_wrong": False,
    }

    return JsonResponse({"status": "started"})


def get_challenge(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Auth required"}, status=401)

    state = request.session.get("2fa")
    if not state:
        return JsonResponse({"error": "2FA not started"}, status=400)

    user_songs = request.user.twofa_songs.all()

    if user_songs.count() < REQUIRED_ROUNDS:
        return JsonResponse({"error": "Not enough songs"}, status=400)

    correct_song = random.choice(list(user_songs))

    all_songs = list(Song.objects.all())
    options = random.sample(all_songs, min(4, len(all_songs)))

    if correct_song not in options:
        options[random.randint(0, len(options) - 1)] = correct_song

    random.shuffle(options)

    state["current_song_id"] = correct_song.id
    request.session["2fa"] = state

    return JsonResponse({
        "round": state["round"] + 1,
        "youtube_url": correct_song.youtube_url,
        "start_time": correct_song.start_time,
        "options": [{"id": s.id, "title": s.title} for s in options],
    })


@csrf_exempt
@require_POST
def submit_answer(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Auth required"}, status=401)

    state = request.session.get("2fa")
    if not state:
        return JsonResponse({"error": "2FA not started"}, status=400)

    selected_id = int(request.POST.get("song_id"))
    correct_id = state.get("current_song_id")

    state["round"] += 1

    # Track if any wrong answer occurred
    if selected_id != correct_id:
        state["any_wrong"] = True

    # If more rounds remain
    if state["round"] < REQUIRED_ROUNDS:
        request.session["2fa"] = state
        return JsonResponse({
            "finished": False
        })

    # After 3 rounds evaluate
    success = not state.get("any_wrong", False)

    if success:
        request.session["fail_sessions"] = 0
    else:
        request.session["fail_sessions"] = request.session.get("fail_sessions", 0) + 1

        if request.session["fail_sessions"] >= 3:
            lock_time = timezone.now() + timedelta(minutes=LOCKOUT_MINUTES)
            request.session["lock_until"] = lock_time.isoformat()
            request.session["fail_sessions"] = 0

    request.session.pop("2fa", None)

    return JsonResponse({
        "finished": True,
        "success": success
    })