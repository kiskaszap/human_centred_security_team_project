from django.db import models
from django.contrib.auth.models import User


class Song(models.Model):
    title = models.CharField(max_length=200)
    youtube_url = models.URLField()
    start_time = models.IntegerField(default=0)  # seconds to start playback

    users = models.ManyToManyField(
        User,
        related_name="twofa_songs",
        blank=True
    )

    def __str__(self):
        return self.title