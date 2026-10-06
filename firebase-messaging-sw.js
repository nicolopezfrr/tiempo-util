// Service worker de las notificaciones. Firebase muestra solo los avisos
// que llegan con la app cerrada y abre la app al tocarlos.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCH2eK5xwpN6f1LGr8a7ork2TIHYQqdjnc",
  authDomain: "tiempo-util.firebaseapp.com",
  projectId: "tiempo-util",
  storageBucket: "tiempo-util.firebasestorage.app",
  messagingSenderId: "904452110931",
  appId: "1:904452110931:web:6554b5b7ddd7935a06e4a6"
});
firebase.messaging();
