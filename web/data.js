// =================================================================
// data.js : Couche de données centralisée (Firestore + fallback localStorage)
// =================================================================
// 
// Cette couche abstrait le stockage. Si Firebase est configuré, elle
// utilise Firestore (données partagées visibles par tous). Sinon,
// elle retombe sur localStorage (comme avant).
//
// L'API publique reste identique : SiteData.getBlogPosts(), etc.
// La différence : les méthodes retournent maintenant des Promises.
// =================================================================

const SiteData = (() => {
    'use strict';

    // --- Données par défaut (hardcodées) ---
    const DEFAULT_BLOG_POSTS = [
        {
            id: 'ddpm-ncsn-medical-imaging',
            title: "NCSN & DDPM : des Score-Based Models à la génération d'images médicales",
            date: "16 Juil 2026",
            readTime: "14 min",
            snippet: "Théorie des modèles de diffusion (NCSN, DDPM), implémentation d'un U-Net ConvNeXt + attention, tests de généralisation, inpainting et application à l'imagerie médicale (PathMNIST).",
            link: "blog-posts/ddpm-ncsn-medical-imaging/index.html"
        }
    ];

    const DEFAULT_PROJECTS = [
        {
            id: 'evidentia',
            title: "Evidentia: Agentic RAG for Scientific Literature",
            description: "A local, evidence-first assistant for querying and comparing arXiv papers with traceable citations.",
            link: "portfolio-projects/evidentia/index.html",
            tags: ["Agentic RAG", "LangGraph", "Qdrant"],
            date: "2026"
        },
        {
            id: 'molecular-graph-captioning',
            title: "ALTeGraD Challenge: Molecular Graph Captioning",
            description: "Multimodal GCN + SciBERT framework with contrastive loss for aligning molecular graphs and text.",
            image: "https://via.placeholder.com/1000x500/bde0fe/2b2d42?text=Molecular+Graph+Captioning",
            link: "portfolio-projects/molecular-graph-captioning/index.html",
            tags: ["GCN", "NLP", "SciBERT"],
            date: "2025"
        },
        {
            id: 'ssl-project',
            title: "Self-supervised Learning for Medical Imaging",
            description: "Implementation of SimCLR and Barlow Twins to evaluate self-supervised learning on MedMNIST.",
            image: "portfolio-projects/ssl-project/ssl.png",
            link: "portfolio-projects/ssl-project/index.html",
            tags: ["Self-supervised", "SimCLR", "Medical Imaging"],
            date: "2025"
        },
        {
            id: 'challenge-ai-ibm-telecom',
            title: "Challenge AI: IBM x Telecom",
            description: "Fraud detection on 300k transactions with feature engineering and Random Forest (F1: 69%).",
            image: "https://via.placeholder.com/1000x500/a2d2ff/ffffff?text=Challenge+AI+IBM+x+Telecom",
            link: "portfolio-projects/challenge-ai-ibm-telecom/index.html",
            tags: ["Machine Learning", "Random Forest", "Fraud Detection"],
            date: "2025"
        },
        {
            id: 'sign-language-recognition',
            title: "Sign Language Recognition",
            description: "Sign language recognition prototype using MediaPipe and a Random Forest model.",
            image: "https://via.placeholder.com/1000x500/bde0fe/2b2d42?text=Sign+Language+Recognition",
            link: "portfolio-projects/sign-language-recognition/index.html",
            tags: ["MediaPipe", "Random Forest", "Computer Vision"],
            date: "2025"
        },
        {
            id: 'exemplar-patch-inpainting',
            title: "Exemplar-Based Patch Inpainting",
            description: "Implementation of the Criminisi method for object removal and image reconstruction.",
            image: "https://via.placeholder.com/1000x500/a2d2ff/ffffff?text=Exemplar-Based+Inpainting",
            link: "portfolio-projects/exemplar-patch-inpainting/index.html",
            tags: ["Image Processing", "Inpainting", "Python"],
            date: "2025"
        },
        {
            id: 'smart-remote-car-qr-navigation',
            title: "Smart Remote Car & QR Code Navigation",
            description: "Raspberry Pi-controlled car with automatic navigation based on QR code beacon detection.",
            image: "https://via.placeholder.com/1000x500/bde0fe/2b2d42?text=Smart+Remote+Car+%26+QR+Navigation",
            link: "portfolio-projects/smart-remote-car-qr-navigation/index.html",
            tags: ["Raspberry Pi", "Embedded", "Python"],
            date: "2024"
        }
    ];

    // =================================================================
    // HELPERS
    // =================================================================

    // --- localStorage helpers (fallback) ---
    function _get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    // --- Check si Firestore est disponible ---
    let _firestoreFailed = false; // Si une opération échoue, on bascule en localStorage

    function useFirestore() {
        if (_firestoreFailed) return false;
        return typeof db !== 'undefined' && db !== null && typeof firebaseReady !== 'undefined' && firebaseReady === true;
    }

    // =================================================================
    // FIRESTORE HELPERS
    // =================================================================

    // Timeout wrapper pour éviter que Firestore reste bloqué indéfiniment
    function withTimeout(promise, ms = 8000) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
        ]);
    }

    function snapshotToArray(snapshot) {
        const arr = [];
        snapshot.forEach(doc => {
            arr.push({ id: doc.id, ...doc.data() });
        });
        return arr;
    }

    // =================================================================
    // CACHE LOCAL
    // =================================================================
    let _cacheBlogs = null;
    let _cacheProjects = null;
    let _cacheBlogsTime = 0;
    let _cacheProjectsTime = 0;
    const CACHE_TTL = 30000; // 30 secondes

    function isCacheValid(time) {
        return (Date.now() - time) < CACHE_TTL;
    }

    // =================================================================
    // API PUBLIQUE
    // =================================================================

    return {
        // --- Blog Posts ---
        async getBlogPosts() {
            if (useFirestore()) {
                if (_cacheBlogs && isCacheValid(_cacheBlogsTime)) {
                    return _cacheBlogs;
                }
                try {
                    const snapshot = await withTimeout(db.collection('blog_posts').orderBy('createdAt', 'desc').get());
                    const posts = snapshotToArray(snapshot);
                    const firestoreIds = posts.map(p => p.id);
                    const defaultsToKeep = DEFAULT_BLOG_POSTS.filter(p => !firestoreIds.includes(p.id));
                    const merged = [...posts, ...defaultsToKeep];
                    _cacheBlogs = merged;
                    _cacheBlogsTime = Date.now();
                    return merged;
                } catch (error) {
                    console.warn('⚠️ Firestore lecture blog_posts échoué, bascule localStorage:', error.message);
                    _firestoreFailed = true;
                    return _get('site_blog_posts', DEFAULT_BLOG_POSTS);
                }
            }
            return _get('site_blog_posts', DEFAULT_BLOG_POSTS);
        },

        // --- Projects ---
        async getProjects() {
            if (useFirestore()) {
                if (_cacheProjects && isCacheValid(_cacheProjectsTime)) {
                    return _cacheProjects;
                }
                try {
                    const snapshot = await withTimeout(db.collection('projects').orderBy('createdAt', 'desc').get());
                    const projects = snapshotToArray(snapshot);
                    const firestoreIds = projects.map(p => p.id);
                    const defaultsToKeep = DEFAULT_PROJECTS.filter(p => !firestoreIds.includes(p.id));
                    const merged = [...projects, ...defaultsToKeep];
                    _cacheProjects = merged;
                    _cacheProjectsTime = Date.now();
                    return merged;
                } catch (error) {
                    console.warn('⚠️ Firestore lecture projects échoué, bascule localStorage:', error.message);
                    _firestoreFailed = true;
                    return _get('site_projects', DEFAULT_PROJECTS);
                }
            }
            return _get('site_projects', DEFAULT_PROJECTS);
        },

        // --- Recherche par ID (pour les pages dynamiques) ---
        async getBlogPostById(id) {
            if (useFirestore()) {
                try {
                    const doc = await withTimeout(db.collection('blog_posts').doc(id).get());
                    if (doc.exists) {
                        return { id: doc.id, ...doc.data() };
                    }
                    return null;
                } catch (error) {
                    console.warn('⚠️ Firestore lecture blog_post par id échoué, bascule localStorage:', error.message);
                    _firestoreFailed = true;
                }
            }
            const posts = _get('site_blog_posts', DEFAULT_BLOG_POSTS);
            return posts.find(p => p.id === id) || null;
        },

        async getProjectById(id) {
            if (useFirestore()) {
                try {
                    const doc = await withTimeout(db.collection('projects').doc(id).get());
                    if (doc.exists) {
                        return { id: doc.id, ...doc.data() };
                    }
                    const defaultProj = DEFAULT_PROJECTS.find(p => p.id === id);
                    return defaultProj || null;
                } catch (error) {
                    console.warn('⚠️ Firestore lecture project par id échoué, bascule localStorage:', error.message);
                    _firestoreFailed = true;
                }
            }
            const projects = _get('site_projects', DEFAULT_PROJECTS);
            return projects.find(p => p.id === id) || null;
        },

        // --- Utilities ---
        DEFAULT_BLOG_POSTS,
        DEFAULT_PROJECTS,

        isFirestoreActive() {
            return useFirestore();
        },

        invalidateCache() {
            _cacheBlogs = null;
            _cacheProjects = null;
        }
    };
})();
