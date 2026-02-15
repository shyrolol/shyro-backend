# shyro-backend

Fortnite Backend for private servers, written in Javascript.

_Credits to Burlone for Reload Backend_
_Credits to Waslyl for XP system (but improved xD)_

*Please report bugs or pull requests for improve user experience !*

## What's new ?

- Arena System : leaderboard, points, save.
- Better host command (create multiples accounts, remove and list) with /host (create, list, remove)
- Delete folders / files and compact into others javascript files (optimization)
- /players command to see every registred players on your project.
- Discord Bot : index.js reworked, faster, commands logs (sync, optimization)..
- Added XP : play a game and receive XP, based on your playtime, kills, and victory.
- NEW BETTER Queue matchmaking : better full matchmaking system, change in your gameserver (work with reboot):
- api.cpp :

#include <curl/curl.h>
#include <string>
#include <cstdlib>
#include "api.h"

static std::string g_serverHost = "127.0.0.1";
static int g_serverPort = 7777;
static std::string g_serverPlaylist = "playlist_showdownalt_solo";

void setServerConfig(const std::string& host, int port, const std::string& playlist) {
    g_serverHost = host;
    g_serverPort = port;
    g_serverPlaylist = playlist;
}

void mmStart() {
    const std::string base_url = "http://127.0.0.1:100/";
    const std::string url = base_url + "start/" + g_serverHost + "/" + std::to_string(g_serverPort) + "/" + g_serverPlaylist;

    CURL* curl = curl_easy_init();
    if (!curl) return;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

    CURLcode res = curl_easy_perform(curl);
    curl_easy_cleanup(curl);
}

void mmClose() {
    const std::string base_url = "http://127.0.0.1:100/";
    const std::string url = base_url + "close/" + g_serverHost + "/" + std::to_string(g_serverPort) + "/" + g_serverPlaylist;

    CURL* curl = curl_easy_init();
    if (!curl) return;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

    CURLcode res = curl_easy_perform(curl);
    curl_easy_cleanup(curl);
}

- api.h :

#pragma once
#include <string>

void setServerConfig(const std::string& host, int port, const std::string& playlist);
void mmStart();
void mmClose();

- Add mmStart(); in FortGameModeAthena.cpp after bStartedListening = true
- Add mmClose(); in gui.h after bStartedBus = true (Countdown and not countdown)

- Public folder : Add anything here can be downloaded or view on the web with backend IP, like DLL redirect for launcher or logo of your project - logic in index.js.
- Launcher login in main.js : improved from Reload Backend, tested with Eon Launcher v2 (need post requests)
- No giftbox for XP or VBucks now : it's added without show you a giftbox

- **SOON :** More discord commands, quests.
