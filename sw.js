// Service worker

function postMsg(msg) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(msg)
    })
  })
}

async function upgrade(msgType) {
  console.time('upgrade')
  console.log('Upgrade start')
  // 拉取最新资源列表
  let resList = (await (await fetch('/resList.txt', { cache: 'no-store' })).text()).split('\n')

  // 清空临时缓存
  await caches.delete('tmp')
  let tmpCache = await caches.open('tmp')

  // 拉取所有资源
  for (let url of resList) {
    if (url.trim() !== '') {
      await tmpCache.put(url, await fetch(url, { cache: 'no-store' }))
    }
  }

  // 清空主缓存
  await caches.delete('main')
  let mainCache = await caches.open('main')

  // 转移临时缓存到主缓存
  let keys = await (await caches.open('tmp')).keys()
  for (let req of keys) {
    mainCache.put(req, await tmpCache.match(req))
  }

  // 删除临时缓存
  await caches.delete('tmp')

  // 更新本地版本
  await (
    await caches.open('setting')
  ).put('/localVersion', await fetch('/version.json', { cache: 'no-store' }))
  console.log('Upgrade done')
  console.timeEnd('upgrade')

  postMsg({ type: msgType })
}

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open('main').then((mainCache) =>
      mainCache.match(event.request).then((response) => {
        // 如果在缓存中找到匹配的响应，则直接返回
        if (response) {
          return response
        }
        // 否则尝试从网络中获取响应
        try {
          if (event.request.url.includes('/version.json')) {
            // 检查版本请求不走缓存
            return fetch(event.request, { cache: 'no-store' })
          }
          return fetch(event.request)
        } catch (e) {
          console.warn(e)
        }
      })
    )
  )
})

self.addEventListener('install', async () => {
  self.skipWaiting()
  upgrade('INSTALL')
})

self.addEventListener('activate', () => {
  console.log('activate')
})

self.addEventListener('message', (e) => {
  if (e.data.type === 'UPGRADE') {
    upgrade('UPGRADE_DONE')
  }
})
