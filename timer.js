// ===== HTML要素を取得する =====
const dishList = document.getElementById("dish-list");
const timerSection = document.getElementById("timer");
const dishImage = document.getElementById("dish-image");
const dishName = document.getElementById("dish-name");
const stepCount = document.getElementById("step-count");
const stepName = document.getElementById("step-name");
const timeDisplay = document.getElementById("time-display");
const progressBar = document.getElementById("progress-bar");
const message = document.getElementById("message");
const startButton = document.getElementById("start-button");
const nextButton = document.getElementById("next-button");
const resetButton = document.getElementById("reset-button");
const demoMode = document.getElementById("demo-mode");
const stepList = document.getElementById("step-list");

// ===== タイマーの状態を入れておく変数 =====
let recipes = [];        // 全部の料理と工程
let currentRecipe = null; // 選んでいる料理
let stepIndex = 0;       // 今の工程の番号（0から数える）
let remaining = 0;       // 残り時間（ミリ秒）
let total = 0;           // 今の工程の時間（ミリ秒）
let timerId = null;      // setIntervalの番号（動いていないときはnull）
let lastTime = 0;        // 前回時間を確認したときの時刻
let audioContext = null; // アラーム音を鳴らすための仕組み
let alarmId = null;      // アラームを繰り返すsetIntervalの番号

// ===== recipes.csv を読み込む =====
fetch("recipes.csv")
    .then(function(response) {
        return response.text();
    })
    .then(function(data) {
        const rows = data.trim().split("\n");
        const headers = rows[0].trim().split(",");

        rows.slice(1).forEach(function(row) {
            // 1行を { dish, image, step, minutes } のオブジェクトにする
            const values = row.trim().split(",");
            const item = {};
            headers.forEach(function(header, index) {
                item[header] = values[index];
            });

            // 同じ料理がまだなければ新しく追加する
            let recipe = recipes.find(function(r) {
                return r.dish === item.dish;
            });
            if (!recipe) {
                recipe = { dish: item.dish, image: item.image, steps: [] };
                recipes.push(recipe);
            }

            // 工程を追加する
            recipe.steps.push({ name: item.step, minutes: Number(item.minutes) });
        });

        showDishes();
    });

// ===== 料理のカードを並べる =====
function showDishes() {
    recipes.forEach(function(recipe) {
        // 全工程の合計時間を計算する
        let totalMinutes = 0;
        recipe.steps.forEach(function(step) {
            totalMinutes += step.minutes;
        });

        const card = document.createElement("button");
        card.className = "dish-card fade-in";

        const img = document.createElement("img");
        img.src = recipe.image;
        img.alt = recipe.dish;

        const name = document.createElement("h3");
        name.textContent = recipe.dish;

        const info = document.createElement("p");
        info.textContent = recipe.steps.length + "工程・合計" + totalMinutes + "分";

        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(info);

        // カードをクリックしたら、その料理を選ぶ
        card.addEventListener("click", function() {
            document.querySelectorAll(".dish-card").forEach(function(c) {
                c.classList.remove("selected");
            });
            card.classList.add("selected");
            selectDish(recipe);
        });

        dishList.appendChild(card);

        // 画面に入ったらふわっと表示されるようにする（effects.js）
        watchFadeIn(card);
    });
}

// ===== 料理を選んだとき =====
function selectDish(recipe) {
    stopTimer();
    stopAlarm();

    currentRecipe = recipe;
    stepIndex = 0;

    dishImage.src = recipe.image;
    dishImage.alt = recipe.dish;
    dishName.textContent = recipe.dish;

    loadStep();

    // タイマーのエリアを表示して、そこまでスクロールする
    timerSection.hidden = false;
    timerSection.scrollIntoView({ behavior: "smooth" });
}

// ===== 今の工程の時間をセットする =====
function loadStep() {
    const step = currentRecipe.steps[stepIndex];

    total = step.minutes * 60 * 1000;
    remaining = total;

    stepCount.textContent = "工程 " + (stepIndex + 1) + " / " + currentRecipe.steps.length;
    stepName.textContent = step.name;
    message.textContent = "";
    message.className = "";

    startButton.textContent = "スタート";
    startButton.disabled = false;
    nextButton.disabled = stepIndex === currentRecipe.steps.length - 1;
    nextButton.classList.remove("highlight");

    showSteps();
    updateDisplay();
}

// ===== 工程の一覧を表示する =====
function showSteps() {
    stepList.innerHTML = "";

    currentRecipe.steps.forEach(function(step, index) {
        const li = document.createElement("li");

        const label = document.createElement("span");
        label.textContent = step.name;

        const time = document.createElement("span");
        time.className = "step-time";
        time.textContent = step.minutes + "分";

        li.appendChild(label);
        li.appendChild(time);

        // 終わった工程と今の工程に印をつける
        if (index < stepIndex) {
            li.className = "done";
        } else if (index === stepIndex) {
            li.className = "current";
        }

        stepList.appendChild(li);
    });
}

// ===== 残り時間を画面に表示する =====
function updateDisplay() {
    const seconds = Math.ceil(remaining / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    // 1桁のときは前に0をつける（例：5 → "05"）
    const text = String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    timeDisplay.textContent = text;

    // 進み具合のバー
    progressBar.style.width = ((1 - remaining / total) * 100) + "%";

    // ブラウザのタブにも残り時間を表示する
    if (timerId) {
        document.title = text + " " + stepName.textContent;
    } else {
        document.title = "Haru's Kitchen Timer";
    }
}

// ===== スタート / 一時停止ボタン =====
startButton.addEventListener("click", function() {
    prepareSound();

    if (timerId) {
        // 動いているときは一時停止
        stopTimer();
        startButton.textContent = "再開";
    } else {
        // 止まっているときはスタート
        lastTime = Date.now();
        timerId = setInterval(tick, 200);
        startButton.textContent = "一時停止";
    }
    updateDisplay();
});

// ===== 0.2秒ごとに残り時間を減らす =====
function tick() {
    const now = Date.now();

    // デモモードのときは60倍の速さで進める（1分 → 1秒）
    let speed = 1;
    if (demoMode.checked) {
        speed = 60;
    }

    remaining -= (now - lastTime) * speed;
    lastTime = now;

    if (remaining <= 0) {
        remaining = 0;
        stopTimer();
        finishStep();
    }

    updateDisplay();
}

// ===== タイマーを止める =====
function stopTimer() {
    clearInterval(timerId);
    timerId = null;
}

// ===== 工程の時間が終わったとき =====
function finishStep() {
    const steps = currentRecipe.steps;

    startButton.disabled = true;
    startButton.textContent = "スタート";
    playAlarm();

    if (stepIndex === steps.length - 1) {
        // 最後の工程が終わったら完成
        stepIndex = steps.length;
        showSteps();
        message.textContent = "🎉 " + currentRecipe.dish + "の完成！お疲れさまでした";
        message.className = "complete";
    } else {
        // 次の工程を案内する
        message.textContent = "「" + steps[stepIndex].name + "」が終わりました。次は「" + steps[stepIndex + 1].name + "」です";
        message.className = "alert";
        nextButton.classList.add("highlight");
    }
}

// ===== 次の工程へボタン =====
nextButton.addEventListener("click", function() {
    stopTimer();
    stopAlarm();

    if (stepIndex < currentRecipe.steps.length - 1) {
        stepIndex++;
        loadStep();
    }
});

// ===== 最初からボタン =====
resetButton.addEventListener("click", function() {
    stopTimer();
    stopAlarm();
    stepIndex = 0;
    loadStep();
});

// ===== アラーム音 =====

// ブラウザはクリックなどの操作をしないと音を出せないので、
// スタートボタンを押したときに音の準備をしておく
function prepareSound() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

// 「ピッ」という短い音を1回鳴らす
function beep(startTime) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;   // 音の高さ（ラの音）

    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.15);
}

// 「ピピピッ」を1秒ごとに5回くり返す
function playAlarm() {
    if (!audioContext) return;

    let count = 0;
    stopAlarm();

    function ring() {
        const t = audioContext.currentTime;
        beep(t);
        beep(t + 0.2);
        beep(t + 0.4);
        count++;
        if (count >= 5) {
            stopAlarm();
        }
    }

    ring();
    alarmId = setInterval(ring, 1000);
}

// アラームを止める
function stopAlarm() {
    clearInterval(alarmId);
    alarmId = null;
}
