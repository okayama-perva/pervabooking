// js/auth.js

const registerBtn = document.getElementById('registerBtn');
if (registerBtn) {
  registerBtn.addEventListener('click', register);
}

const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
  loginBtn.addEventListener('click', login);
}

function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const username = document.getElementById('username').value;

  if (!username) {
    alert('表示名を入力してください。');
    return;
  }

  registerBtn.disabled = true;
  const originalText = registerBtn.innerText;
  registerBtn.innerText = '登録中...';

  auth.createUserWithEmailAndPassword(email, password)
    .then((cred) => {
      return db.collection('users').doc(cred.user.uid).set({
        username: username,
        email: email,
      });
    })
    .then(() => {
      alert('登録完了！ログインしてください。');
      registerBtn.disabled = false;
      registerBtn.innerText = originalText;
      window.location.href = '/auth/login.html';
    })
    .catch((err) => {
      alert('登録失敗しました。登録済みでは？ログインとして再試行してください');
      registerBtn.disabled = false;
      registerBtn.innerText = originalText;
    });
}

function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  loginBtn.disabled = true;
  const originalText = loginBtn.innerText;
  loginBtn.innerText = 'ログイン中...';

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      const expireAt = Date.now() + 3 * 24 * 60 * 60 * 1000;
      localStorage.setItem('authExpireAt', expireAt);
      window.location.href = '/index.html';
    })
    .catch((err) => {
      alert('ログイン失敗：メールアドレス・パスワードを確認してください');
      loginBtn.disabled = false;
      loginBtn.innerText = originalText;
    });
}
