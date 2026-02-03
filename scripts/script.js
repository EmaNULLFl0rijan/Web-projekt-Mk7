const firebaseConfig = {
    apiKey: "AIzaSyBjGEeMYInhq2ROS9rfQAgr_dJSAgbHa3Q",
    authDomain: "studyshare-753af.firebaseapp.com",
    projectId: "studyshare-753af",
    storageBucket: "studyshare-753af.firebasestorage.app",
    messagingSenderId: "409933445236",
    appId: "1:409933445236:web:5b46420f9cbb9097363921",
    measurementId: "G-6KJ9YE823F"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const REQUESTS_COL = "requests";
const GALLERY_COL = "gallery";

let currentUser = null;

function loadRequestsRealtime() {
    db.collection(REQUESTS_COL).orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        const tbody = document.querySelector('#requests-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const req = doc.data();
            const row = `
                <tr>
                    <td><strong>${req.faculty}</strong></td>
                    <td>${req.course}</td>
                    <td>${req.prof}</td>
                    <td>${req.ects}</td>
                    <td>${req.comment || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
}

window.handleAddRequest = async () => {
    const faculty = document.getElementById('req-faculty').value;
    const course = document.getElementById('req-course').value;
    const prof = document.getElementById('req-prof').value;
    const ects = document.getElementById('req-ects').value;
    const comment = document.getElementById('req-comment').value;

    if (!faculty || !course) {
        alert("Molimo unesite barem Fakultet i Naziv kolegija.");
        return;
    }

    try {
        await db.collection(REQUESTS_COL).add({
            faculty: faculty,
            course: course,
            prof: prof,
            ects: ects,
            comment: comment,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user: currentUser ? currentUser.uid : "anon"
        });

        document.getElementById('req-faculty').value = '';
        document.getElementById('req-course').value = '';
        document.getElementById('req-prof').value = '';
        document.getElementById('req-ects').value = '';
        document.getElementById('req-comment').value = '';

    } catch (error) {
        console.error("Greška pri dodavanju: ", error);
        alert("Došlo je do greške pri slanju zahtjeva.");
    }
};

function loadGalleryRealtime() {
    db.collection(GALLERY_COL).orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        const container = document.getElementById('gallery-container');
        if (!container) return;

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const id = doc.id;

            const likedBy = item.likedBy || [];
            const isLiked = currentUser && likedBy.includes(currentUser.uid);
            const likeClass = isLiked ? 'like-btn liked' : 'like-btn';

            let previewContent;


            if (item.type === 'image') {
                previewContent = `<img src="${item.fileUrl}" alt="${item.title}" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\'fas fa-image\'></i>';">`;
            } else {
                previewContent = `<i class="fas fa-file-pdf" style="font-size: 3rem;"></i>`;
            }

            let commentsHtml = (item.comments || []).map(c => `<div class="single-comment">${c}</div>`).join('');

            const card = `
            <div class="gallery-item">
                <div class="gallery-img-container">
                    <a href="${item.fileUrl}" target="_blank" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; text-decoration:none; color:inherit;">
                        ${previewContent}
                    </a>
                </div>
                <div class="gallery-content">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:5px;">
                        <h4 style="margin:0;">${item.title}</h4>
                        <a href="${item.fileUrl}" target="_blank" class="download-icon-link" title="Otvori link">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                    <p style="font-size: 0.75rem; color: gray;">Objavio: ${item.userName || 'Student'}</p>
                    
                    <div class="gallery-actions">
                        <span class="${likeClass}" onclick="toggleLike('${id}')">
                            <i class="fas fa-heart"></i> <span class="like-count">${item.likes || 0}</span>
                        </span>
                    </div>

                    <div class="comments-section">
                        <div class="comment-list" id="comments-${id}">
                            ${commentsHtml}
                        </div>
                        <input type="text" class="comment-input" placeholder="Napiši komentar..." 
                            onkeypress="handleComment(event, '${id}')">
                    </div>
                </div>
            </div>
            `;
            container.innerHTML += card;
        });
    });
}

window.handleComment = async (event, docId) => {
    if (event.key === 'Enter') {
        const text = event.target.value;
        if (text.trim() !== "") {
            try {
                await db.collection(GALLERY_COL).doc(docId).update({
                    comments: firebase.firestore.FieldValue.arrayUnion(text)
                });
                event.target.value = '';
            } catch (e) { console.error(e); }
        }
    }
};

window.toggleLike = async (docId) => {
    if (!currentUser) {
        alert("Pričekajte trenutak da se učita korisnik...");
        return;
    }

    const docRef = db.collection(GALLERY_COL).doc(docId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) return;

            const data = doc.data();
            const likedBy = data.likedBy || [];
            const currentLikes = data.likes || 0;
            const uid = currentUser.uid;

            if (likedBy.includes(uid)) {
                transaction.update(docRef, {
                    likes: currentLikes - 1,
                    likedBy: firebase.firestore.FieldValue.arrayRemove(uid)
                });
            } else {
                transaction.update(docRef, {
                    likes: currentLikes + 1,
                    likedBy: firebase.firestore.FieldValue.arrayUnion(uid)
                });
            }
        });
    } catch (e) {
        console.error("Greška pri lajkanju: ", e);
    }
};

window.uploadMaterialLink = async () => {

    const titleInput = document.getElementById('upload-title');
    const typeInput = document.getElementById('upload-type');
    const urlInput = document.getElementById('upload-url');
    const statusText = document.getElementById('upload-status');
    const btn = document.getElementById('btn-upload');

    const title = titleInput.value.trim();
    const type = typeInput.value;
    const url = urlInput.value.trim();

    if (!title || !url) {
        alert("Molim unesite naziv i valjani link.");
        return;
    }

    try {
        btn.disabled = true;
        statusText.innerText = "Objavljivanje...";

        await db.collection(GALLERY_COL).add({
            title: title,
            type: type,
            fileUrl: url,
            likes: 0,
            likedBy: [],
            comments: [],
            user: currentUser.uid,
            userName: 'Anonimni Student',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        titleInput.value = '';
        urlInput.value = '';
        statusText.innerText = "Materijal uspješno objavljen!";
        setTimeout(() => statusText.innerText = "", 3000);

    } catch (error) {
        console.error("Greška:", error);
        statusText.innerText = "Greška: " + error.message;
    } finally {
        btn.disabled = false;
    }
};

window.onload = function () {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("User Logged In:", user.uid);
        } else {
            console.log("Signing in anonymously...");
            firebase.auth().signInAnonymously().catch((error) => {
                console.error("Auth Error:", error);
            });
        }

        if (document.getElementById('requests-table')) {
            loadRequestsRealtime();
        }

        if (document.getElementById('gallery-container')) {
            loadGalleryRealtime();
        }
    });
};

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}