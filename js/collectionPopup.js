// ==========================================
// COLLECTION POPUP
// Modal popups for trophy/collection items
// ==========================================

import { COLLECTIONS } from './projectData.js';

let popupEl = null;
let gridEl = null;
let titleEl = null;
let nameEl = null;
let counterEl = null;
let chooseBtn = null;
let backBtn = null;

let isOpen = false;
let currentCategory = null;
let selectedIndex = 0;

export function initCollectionPopup() {
    popupEl = document.getElementById('collection-popup');
    gridEl = document.getElementById('cp-grid');
    titleEl = document.getElementById('cp-title');
    nameEl = document.getElementById('cp-name');
    counterEl = document.getElementById('cp-counter');
    chooseBtn = document.getElementById('cp-choose');
    backBtn = document.getElementById('cp-back');

    backBtn.addEventListener('click', closeCollectionPopup);
    chooseBtn.addEventListener('click', onChoose);

    document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeCollectionPopup();
        }
    });
}

export function openCollectionPopup(categoryKey) {
    const collection = COLLECTIONS[categoryKey];
    if (!collection) return;

    currentCategory = categoryKey;
    selectedIndex = 0;
    isOpen = true;

    titleEl.textContent = collection.title;
    gridEl.innerHTML = '';

    if (collection.items.length === 0) {
        gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">No items yet</div>';
        nameEl.textContent = '--';
        counterEl.textContent = '0/0';
    } else {
        collection.items.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'collection-popup__grid-item';
            if (item.thumbnail) {
                div.style.backgroundImage = `url(${item.thumbnail})`;
            }
            if (i === 0) div.classList.add('selected');
            div.addEventListener('click', () => selectItem(i));
            gridEl.appendChild(div);
        });
        updateFooter(collection);
    }

    popupEl.classList.add('active');
}

export function closeCollectionPopup() {
    isOpen = false;
    currentCategory = null;
    popupEl.classList.remove('active');
}

export function isCollectionOpen() {
    return isOpen;
}

function selectItem(index) {
    const collection = COLLECTIONS[currentCategory];
    if (!collection) return;

    selectedIndex = index;
    const items = gridEl.querySelectorAll('.collection-popup__grid-item');
    items.forEach((el, i) => {
        el.classList.toggle('selected', i === index);
    });
    updateFooter(collection);
}

function updateFooter(collection) {
    const item = collection.items[selectedIndex];
    nameEl.textContent = item ? item.name : '--';
    counterEl.textContent = `${selectedIndex + 1}/${collection.items.length}`;
}

function onChoose() {
    const collection = COLLECTIONS[currentCategory];
    if (!collection || collection.items.length === 0) return;

    const item = collection.items[selectedIndex];
    console.log('Collection item chosen:', currentCategory, item);
    closeCollectionPopup();
}
