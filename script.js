const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const chat = document.getElementById("chat");
const micBtn = document.getElementById("micBtn");
const themeToggle = document.getElementById("themeToggle");

/* ATIVAR BOTÃO */
input.addEventListener("input", () => {
    sendBtn.disabled = input.value.trim() === "";
});

/* ENVIAR */
document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
        const msg = card.getAttribute("data-msg");

        if (!msg) {
            console.warn("Card sem data-msg:", card);
            return;
        }

        input.value = msg;
        sendBtn.disabled = false;

        enviar();
    });
});
sendBtn.addEventListener("click", enviar);

input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") enviar();
});

let config = null;

async function carregarConfig() {
    try {
        const res = await fetch("keys.json");
        config = await res.json();
        console.log("Config carregada:", config);
    } catch (e) {
        console.error("Erro ao carregar keys.json", e);
    }
}

// garante que carregou antes de usar
window.addEventListener("load", carregarConfig);

async function enviar() {
    const texto = input.value.trim();
    if (!texto) return;

    if (!config) {
        adicionarMensagem("⚠️ Config não carregada.", "bot");
        return;
    }

    adicionarMensagem(texto, "user");

    input.value = "";
    sendBtn.disabled = true;

    // cria mensagem vazia do bot
    const div = document.createElement("div");
    div.className = "msg bot";
    div.innerHTML = `<div class="bubble"></div>`;
    chat.appendChild(div);

    const bubble = div.querySelector(".bubble");

    try {
        const response = await fetch(
            `${config.endpoint}openai/deployments/${config.deployment}/chat/completions?api-version=2024-02-15-preview`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": config.apiKey
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: "Você é um assistente do SENAI. Não utilize markdown, e deixe a resposta mais leve possivel" },
                        { role: "user", content: texto }
                    ],
                    max_completion_tokens: 1000,
                    stream: true // 🔥 ATIVA STREAM
                })
            }
        );

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let textoFinal = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const linhas = chunk.split("\n");

            for (let linha of linhas) {
                if (linha.startsWith("data: ")) {
                    const data = linha.replace("data: ", "").trim();

                    if (data === "[DONE]") break;

                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta?.content;

                        if (delta) {
                        textoFinal += delta;

                        // escreve devagar só o pedaço novo
                        await digitarDevagar(delta, bubble, 15);

                        chat.scrollTop = chat.scrollHeight;
                        }
                    } catch (e) {
                        // ignora erros de parse parcial
                    }
                }
            }
        }

    } catch (error) {
        console.error(error);
        bubble.innerText = "❌ Erro no streaming.";
    }
}

function digitarDevagar(texto, elemento, velocidade = 20) {
    return new Promise(resolve => {
        let i = 0;

        function escrever() {
            if (i < texto.length) {
                elemento.innerText += texto.charAt(i);
                i++;
                setTimeout(escrever, velocidade);
            } else {
                resolve();
            }
        }

        escrever();
    });
}

function falarTexto(texto) {
    const synth = window.speechSynthesis;

    // para qualquer fala anterior
    synth.cancel();

    const fala = new SpeechSynthesisUtterance(texto);

    fala.lang = "pt-BR";
    fala.rate = 1;     // velocidade (0.5 a 2)
    fala.pitch = 1;    // tom (0 a 2)
    fala.volume = 1;   // volume (0 a 1)

    // escolher voz em português (se existir)
    const vozes = synth.getVoices();
    const vozPT = vozes.find(v => v.lang === "pt-BR");

    if (vozPT) fala.voice = vozPT;

    synth.speak(fala);
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };

}
falarTexto(textoFinal);

/* ADICIONAR MSG */
function adicionarMensagem(texto, tipo) {
    const div = document.createElement("div");
    div.className = "msg " + tipo;

    div.innerHTML = `<div class="bubble">${texto}</div>`;
    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;
}

/* 🎤 MICROFONE */
// 🎤 RECONHECIMENTO DE VOZ (CHROME)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    let gravando = false;

    micBtn.onclick = () => {
        if (!gravando) {
            recognition.start();
        } else {
            recognition.stop();
        }
    };

    recognition.onstart = () => {
        gravando = true;
        micBtn.classList.add("gravando");
        document.getElementById("transcricao").innerText = "Ouvindo...";
    };

    recognition.onresult = (event) => {
        let texto = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
            texto += event.results[i][0].transcript;
        }

        document.getElementById("transcricao").innerText = texto;

        // joga direto no input
        input.value = texto;
        sendBtn.disabled = false;
    };

    recognition.onend = () => {
        gravando = false;
        micBtn.classList.remove("gravando");
        document.getElementById("transcricao").innerText = "Clique e fale...";
    };

    recognition.onerror = (event) => {
        console.error("Erro no microfone:", event.error);
        gravando = false;
        micBtn.classList.remove("gravando");
        document.getElementById("transcricao").innerText = "Erro ao usar microfone";
    };

} else {
    // Caso o navegador não suporte
    micBtn.onclick = () => {
        alert("Seu navegador não suporta reconhecimento de voz 😢\nUse o Google Chrome.");
    };
}

/* 🌙 TEMA */
document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const btn = document.getElementById("themeToggle");
    const icon = btn.querySelector("i");

    // carregar tema salvo
    const temaSalvo = localStorage.getItem("tema");

    if (temaSalvo) {
        body.className = temaSalvo;
    }

    atualizarIcone();

    btn.addEventListener("click", () => {
        if (body.classList.contains("dark")) {
            body.classList.remove("dark");
            body.classList.add("light");
            localStorage.setItem("tema", "light");
        } else {
            body.classList.remove("light");
            body.classList.add("dark");
            localStorage.setItem("tema", "dark");
        }

        atualizarIcone();
    });

    function atualizarIcone() {
        if (body.classList.contains("dark")) {
            icon.className = "fa-solid fa-moon";
        } else {
            icon.className = "fa-solid fa-sun";
        }
    }
});