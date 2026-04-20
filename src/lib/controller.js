/**
 * Core Controller Framework
 * Handles DOM mapping, event triggers, pub/sub messaging, and caching.
 */
export function controller({ stringComponent, domComponent }) {
    let component
    if (domComponent) component = domComponent
    if (stringComponent) {
        let tempElement = document.createElement('div')
        tempElement.innerHTML = stringComponent
        component = tempElement.firstElementChild
    }

    let state = {}
    state['queue'] = {}
    state['triggers'] = {}
    state['unsubs'] = []
    let store = {}
    let activeTimeouts = []

    let obj = {
        onboard: ({ id, className }) => {
            if (id) state[id] = component.querySelector(`#${id}`)
            if (className) state[className] = component.querySelector(`.${className}`)
            return obj
        },
        unsub: (fn) => {
            if (typeof fn === 'function') state.unsubs.push(fn)
            return obj
        },
        trigger: (event, id, cbfn) => {
            state.triggers[id] = (state.triggers[id] || []).concat([{ 'type': event, 'cb': cbfn }])
            if (state[id]) {
                state[id].addEventListener(event, cbfn)
            }
            return obj
        },
        applyTrigger: (event, id, cbfn) => {
            state.triggers[id] = (state.triggers[id] || []).concat([{ 'type': event, 'cb': cbfn }])
            if (state[id]) {
                state[id].addEventListener(event, cbfn)
            }
            return obj
        },
        $: (id) => {
            return state[id]
        },
        on: (message, renderfn) => {
            state.queue[message] = (state.queue[message] || []).concat([renderfn])
            return obj
        },
        message: (message, ...payload) => {
            if (!state.queue) return obj
            let cbfnList = state.queue[message]
            if (cbfnList?.length) {
                cbfnList.forEach(element => {
                    element(...payload)
                });
            }
            return obj
        },
        emit: (message, ...payload) => {
            return obj.message(message, ...payload);
        },
        defer: (action, delay = 0) => {
            const timeoutId = setTimeout(() => {
                action();
                activeTimeouts = activeTimeouts.filter(id => id !== timeoutId);
            }, delay);
            activeTimeouts.push(timeoutId);
            return obj;
        },
        destroy: () => {
            // Clear all active timeouts
            activeTimeouts.forEach(clearTimeout);
            activeTimeouts = [];

            // Call all unsubscriptions (e.g. Firebase snapshots)
            state.unsubs.forEach(unsub => {
                try { unsub(); } catch (e) { console.error('Unsub error:', e); }
            });
            state.unsubs = [];

            // Remove all event listeners registered via trigger/applyTrigger
            Object.keys(state.triggers).forEach(id => {
                const el = state[id];
                if (el) {
                    state.triggers[id].forEach(t => {
                        el.removeEventListener(t.type, t.cb);
                    });
                }
            });

            // Clear internal state
            state.queue = {};
            state.triggers = {};
            state = {};
            
            return obj;
        },
        delete: (id) => {
            const el = state[id];
            if (el) {
                el.textContent = ''
                el.innerHTML = ''
            }

            return obj;
        },
        insert: (elem, og_id, into_id) => {
            state[into_id].prepend(elem)
            state[og_id] = elem
            let triggers = state.triggers[og_id]
            if (triggers?.length) {
                triggers.forEach(trigger => {
                    state[og_id].addEventListener(trigger.type, trigger.cb)
                })
            }
            return obj
        },
        jsonp: async (url) => {
            return new Promise((resolve, reject) => {
                const callbackName = 'jsonp_callback_' + Math.round(Math.random() * 100000);
                window[callbackName] = function (data) {
                    resolve(data);
                    delete window[callbackName];
                    script.parentNode.removeChild(script);
                };
                const script = document.createElement('script');
                script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + 
callbackName;
                script.onerror = () => {
                    reject(new Error(`JSONP request to ${url} failed`));
                    delete window[callbackName];
                    script.parentNode.removeChild(script);
                };
                document.body.appendChild(script);
            });
        },
        setCache: (key, data) => {
            store[key] = data
            return obj
        },
        getCache: (key, isDelete) => {
            let temp = store[key]
            if (isDelete) delete store[key]
            return temp
        },
        element: () => {
            return component
        }
    }
    return obj
}
