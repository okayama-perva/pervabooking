// common/authGuard.js

auth.onAuthStateChanged((user) => {
  const expireAt = parseInt(localStorage.getItem('authExpireAt') || '0', 10);

  if (user && expireAt && Date.now() > expireAt) {
    // セッション切れ → ログアウト + リダイレクト
    auth.signOut().then(() => {
      localStorage.removeItem('authExpireAt');
      alert('セッションが切れました。再度ログインしてください。');
      window.location.href = '/auth/login.html';
    });
    return;
  }

  if (!user) {
    // 未ログイン → ログインページへ
    window.location.href = '/auth/login.html';
  }
});
