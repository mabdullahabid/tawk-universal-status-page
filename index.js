// Global variable to store repName
const loginPropertyId = "5d1d468822d70e36c2a408f8";
const secretKey = 'af96821caac1f551f21182d47b3746d4cf4f7176';
const baseUrl = "https://hub.memox.io/api/v1/"
// const baseUrl = "http://localhost:8000/api/v1/"
let token = null
let roomId = null
let visitorId = null
let authUserId = null
const urlParams = new URLSearchParams(window.location.search);
const name = urlParams.get("name");
const email = urlParams.get("email");
const phone = urlParams.get("phone");
const userId = urlParams.get("userId");
const tawkUrl = urlParams.get("url")
const sessionId = urlParams.get("sessionId")


function hashInBase64(userId) {
    var hash = CryptoJS.HmacSHA256(userId, secretKey);
    return CryptoJS.enc.Hex.stringify(hash);
}

const sendRequest = async (tawkUrl) => {
    try {
        const TOKEN = "G7Lj8R2bF5oAK1O7VldLBUo0xaC9ah4t";
        const url = `https://browserless.memox.io/function?token=${TOKEN}`;

        // The function code must be properly formatted as a string
        const functionCode = `
export default async function ({ page }) {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.goto('https://tawk.to/${tawkUrl}', {
        waitUntil: 'networkidle2',
        timeout: 30000,
    });

    await Promise.race([
        page.waitForSelector('script[src*="embed.tawk.to"]', { timeout: 10000 }),
        page.waitForSelector('#report-property-id', { timeout: 10000 })
    ]).catch(() => {});

    const result = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src*="embed.tawk.to"]'));
        const repName = document.title.split(" ").slice(2).join(" ");
        const output = [];

        scripts.forEach(script => {
            try {
                const src = script.src;
                const match = src.match(/https?:\\/\\/embed\\.tawk\\.to\\/([a-f0-9]{24})\\/([^\\/]+)/i);
                if (match) {
                    output.push({
                        propertyId: match[1],
                        widgetId: match[2],
                        scriptSrc: src,
                        repName: repName,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (e) {}
        });

        return output.length > 0 ? output : { error: "No Tawk.to scripts found" };
    });

    return {
        status: "success",
        data: result,
        metadata: {
            url: page.url(),
            scrapedAt: new Date().toISOString()
        }
    };
}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/javascript'
            },
            body: functionCode
        });

        const rawResponse = await response.json();
        return rawResponse.data[0]

    } catch (error) {
        console.error("Request failed:", error);
        throw error;
    }
};

let currentRepName = '';

(async function () {
    try {

        // Fetch Tawk.to IDs from your backend
        const result = await sendRequest(tawkUrl)

        const { propertyId, widgetId, repName } = result;
        currentRepName = repName; // Store the repName globally

        // Update agent display in header immediately
        updateAgentDisplay(repName);

        // Get visitor attributes from URL

        // Validate required parameters
        if (!propertyId || !name || !email || !phone || !userId || !sessionId) {
            showError("Missing required parameters");
            return;
        }

        await new Promise((resolve) => {
            loadTawkScript(propertyId, widgetId, async function () {
                window.Tawk_API.setAttributes({
                    hash: hashInBase64(userId),
                    userId: userId,
                    name: name,
                    email: email,
                    phone: phone
                })
                await loginTawkUser()
                await createVisitor()
                resolve();
            });
        });

    } catch (error) {
        console.error('Failed during initialization:', error);
        showError("Connection error. Please try again later.");
    }
})();



function updateAgentDisplay(repName) {
    const agentDisplay = document.getElementById('agentHeaderDisplay');
    agentDisplay.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(repName)}&background=3498db&color=fff&size=128" 
                     alt="${repName}" class="agent-avatar">
                <div class="agent-name">${repName}</div>
            `;
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('chatStatus').innerHTML = `
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="
                    background: var(--secondary-color);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 1rem;
                ">Try Again</button>
            `;
}

function loadTawkScript(propertyId, widgetId, callback) {
    // Load new script
    var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
    window.Tawk_API = Tawk_API;

    var s1 = document.createElement("script");
    var s0 = document.getElementsByTagName("script")[0];
    s1.async = true;
    s1.src = `https://embed.tawk.to/${propertyId}/${widgetId || 'default'}`;
    s1.id = propertyId
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode.insertBefore(s1, s0);
    window.Tawk_API.onBeforeLoad = function () {
        window.Tawk_API.maximize();
    };

    window.Tawk_API.onChatMessageVisitor = function (obj) {

        (async function () {
            if (!roomId) {
                await getOrCreateSession()
            }

            await createMessageBySession('prospect', obj?.message, roomId, visitorId, authUserId)


        }())

    }

    window.Tawk_API.onChatMessageAgent = function (obj) {

        (async function () {
            if (!roomId) {
                await getOrCreateSession()
            }

            await createMessageBySession('sales_rep', obj?.message, roomId, authUserId, visitorId)


        }())

    }


    if (callback) {
        window.Tawk_API.onLoad = callback;
    }

    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('chatStatus').textContent = 'Chat is now ready. Please use the chat window below.';


}


function tawkLogin(userData) {
    return new Promise((resolve, reject) => {
        window.Tawk_API.login({
            hash: hashInBase64(userData.userId),
            userId: userData.userId,
            name: userData.name,
            email: userData.email,
            // phone: userData.phone
        }, function (error) {
            if (error) {
                console.error("Error setting attributes:", error);
                showError("Error initializing chat");
                reject(error);
            } else {
                document.getElementById('loadingScreen').style.display = 'none';
                document.getElementById('chatStatus').textContent = 'Chat is now ready. Please use the chat window below.';
                window.Tawk_API.switchWidget({
                    propertyId: userData.propertyId,
                    widgetId: userData.widgetId
                }, function (err) {
                    var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
                    window.Tawk_API = Tawk_API;

                    var s1 = document.createElement("script");
                    var s0 = document.getElementsByTagName("script")[0];
                    s1.async = true;
                    s1.src = `https://embed.tawk.to/${userData.propertyId}/${userData.widgetId || 'default'}`;
                    s1.id = userData.propertyId
                    s1.charset = 'UTF-8';
                    s1.setAttribute('crossorigin', '*');
                    s0.parentNode.insertBefore(s1, s0);

                    window.Tawk_API.onLoad = function () {
                        window.Tawk_API.setAttributes({
                            hash: hashInBase64(userData.userId),
                            userId: userData.userId,
                            name: userData.name,
                            email: userData.email,
                            phone: userData.phone
                        })
                    }

                })


                resolve();
            }
        });

    });
}

// kedev46079@inkight.com
function tawkSetAttributes(userData) {
    return new Promise((resolve, reject) => {
        window.Tawk_API.setAttributes({
            hash: hashInBase64(userData.userId),
            userId: userData.userId,
            name: userData.name,
            email: userData.email,
            phone: userData.phone
        }, function (error) {
            if (error) {
                console.error("Error setting attributes:", error);
                reject(error);
            } else {

                resolve();
            }
        });

    });
}


async function loginTawkUser() {
    const data = {
        email: "tawkuser@autonomoustech.ca",
        password: "Memox@123"
    }
    const response = await fetch(`${baseUrl}auth/login/`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        },
    })
    const reponseToJson = await response.json()
    token = reponseToJson.key
    authUserId = reponseToJson.user_id
    return reponseToJson.key
}


async function getOrCreateSession() {
    const result = await fetch(`${baseUrl}sessions/${sessionId}/`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,

        }
    })
    const sessionData = await result.json()
    if (sessionData?.detail === "Not found.") {
        const createSessionData = await fetch(`${baseUrl}sessions/`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${token}`,

            },
            body: JSON.stringify({
                room_name: sessionId,
                is_active: true,
                is_handover: true,
                visitor: visitorId,
                organization: 14,
                bot: 12

            })
        })

        const createSessionDataJson = await createSessionData.json()
        roomId = createSessionDataJson.id

    }
    else roomId = sessionData?.id


}


const createMessageBySession = async (sender_type, content, room = roomId, sender, receiver) => {
    await fetch(`${baseUrl}messages/`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token} `,

        },
        body: JSON.stringify({
            room,
            sender,
            receiver,
            "sender_type": sender_type,
            message_type: "text",
            is_read: false,
            content
        })
    })

}

const createVisitor = async () => {

    const getVisitor = await fetch(`${baseUrl}visitors/?email=${email}`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token} `,
        }
    })

    const getVisitorJson = await getVisitor.json();

    if (getVisitorJson.detail === "Not found." || !getVisitorJson.length) {
        // If visitor does not exist, create a new one
        const visitor = await fetch(`${baseUrl}visitors/`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${token} `,

            },
            body: JSON.stringify({
                name,
                email,
                phone_number: phone,
            })
        })
        const visitorData = await visitor.json();
        visitorId = visitorData.id;
    }
    else visitorId = getVisitorJson[0].id;

}