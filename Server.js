const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DB_FILE = path.join(__dirname, 'users.json');

const loadDB = () => {
    if (fs.existsSync(DB_FILE)) {
        return JSON.parse(fs.readFileSync(DB_FILE));
    }
    return { users: [], codes: {} };
};

const saveDB = (db) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
};

// ВАШ КЛЮЧ RESEND УЖЕ ВСТАВЛЕН СЮДА
const resend = new Resend('re_c7ptjb8F_EVTFsQNTH57ppssQqeE9TGKy');

// 1. Регистрация
app.post('/api/register', async (req, res) => {
    const { nick, email, pass, region } = req.body;
    const db = loadDB();
    
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Эта почта уже зарегистрирована!' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.codes[email] = code;
    db.users.push({ nick, email, pass, region, verified: false });
    saveDB(db);

    try {
        await resend.emails.send({
            from: 'VasilCryptoBank@gmail.com',
            to: email,
            subject: 'Код подтверждения Крипта Банк',
            text: `Ваш код подтверждения: ${code}`
        });
    } catch (error) {
        console.log('Ошибка отправки письма:', error);
        return res.status(500).json({ message: 'Ошибка отправки письма.' });
    }

    res.json({ message: 'Код отправлен на почту!' });
});

// 2. Вход
app.post('/api/login', async (req, res) => {
    const { email, pass } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.email === email && u.pass === pass);

    if (!user) {
        return res.status(400).json({ message: 'Неверная почта или пароль' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.codes[email] = code;
    saveDB(db);

    try {
        await resend.emails.send({
            from: 'VasilCryptoBank@gmail.com',
            to: email,
            subject: 'Код для входа в Крипта Банк',
            text: `Ваш код для входа: ${code}`
        });
    } catch (error) {
        console.log('Ошибка отправки письма:', error);
        return res.status(500).json({ message: 'Ошибка отправки письма.' });
    }

    res.json({ message: 'Код отправлен на почту!' });
});

// 3. Проверка кода
app.post('/api/verify', (req, res) => {
    const { email, code } = req.body;
    const db = loadDB();

    if (db.codes[email] && db.codes[email] === code) {
        delete db.codes[email]; 
        const userIndex = db.users.findIndex(u => u.email === email);
        if (userIndex !== -1) {
            db.users[userIndex].verified = true;
            saveDB(db);
            return res.json({ success: true, user: { nick: db.users[userIndex].nick, email } });
        }
    }
    res.status(400).json({ message: 'Неверный код' });
});

// 4. Проверка сессии (чтобы при перезагрузке не просил вход)
app.post('/api/check-session', (req, res) => {
    const { email } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.email === email);
    if (user && user.verified) {
        return res.json({ valid: true });
    }
    res.json({ valid: false });
});

// Запуск сервера на всех интерфейсах
app.listen(3000, '0.0.0.0', () => {
    console.log('Сервер Крипта Банка запущен на порту 3000');
});
