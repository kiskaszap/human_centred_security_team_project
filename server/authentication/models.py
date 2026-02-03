from django.db import models
from django.contrib.auth.models import User

class Song(models.Model):
    title = models.CharField(max_length=200)
    audio_file = models.FileField(upload_to="audio/")

    def __str__(self):
        return self.title


class UserPlaylist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    song = models.ForeignKey(Song, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.user.username} - {self.song.title}"
