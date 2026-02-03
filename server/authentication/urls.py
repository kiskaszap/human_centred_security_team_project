from django.urls import path
from . import views

urlpatterns = [
    path("csrf/", views.csrf),
    path("login/", views.login_view),
    path("2fa/start/", views.start_2fa),
    path("2fa/challenge/", views.get_challenge),
    path("2fa/answer/", views.submit_answer),
]
