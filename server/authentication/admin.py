from django.contrib import admin
from .models import Song, UserPlaylist

admin.site.register(Song)
admin.site.register(UserPlaylist)
