/* eslint-disable */
import { createSelector, createSlice } from '@reduxjs/toolkit'
import { CHAINX_MAIN, CHAINX_TEST, events, NODE_STORE_KEY } from './constants'
import { chainxNetwork, networkSelector } from './settingSlice'
import {
  removeInstance,
  setChainxInstances
} from '../../shared/chainxInstances'

export const mainNetInitNodes = [
  {
    name: 'w1.org',
    url: 'wss://w1.chainx.org/ws'
  },
  {
    name: 'w2.org',
    url: 'wss://w2.chainx.org/ws'
  },
  {
    name: 'HashQuark',
    url: 'wss://chainx.hashquark.io'
  },
  {
    name: 'BuildLinks',
    url: 'wss://chainx.buildlinks.org'
  },
  {
    name: 'w1.cn',
    url: 'wss://w1.chainx.org.cn/ws'
  }
]

export const testNetInitNodes = [
  {
    name: 'testnet.w1.org.cn',
    url: 'wss://testnet.w1.chainx.org.cn/ws'
  }
]

const defaultNodeInitialState = {
  /**
   * version 1:
   * 1. 去掉了testnetNodesDelay和mainnetNodesDelay
   * 2. 将delay信息直接保存在node对象中
   */
  version: 1,
  chainxMainNetNodes: mainNetInitNodes,
  currentChainXMainNetNode: mainNetInitNodes[0],
  chainxTestNetNodes: testNetInitNodes,
  currentChainXTestNetNode: testNetInitNodes[0]
}

const initialState = do {
  const storedState = window.nodeStore.get(NODE_STORE_KEY)
  if (storedState.version < 1 || !storedState) {
    defaultNodeInitialState
  } else {
    storedState
  }
}

export const initChainxInstances = () => {
  setChainxInstances(
    [
      ...initialState.chainxMainNetNodes,
      ...initialState.chainxTestNetNodes
    ].map(node => node.url)
  )
}

function findTargetNodes(state, chainId) {
  let targetNodes
  if (CHAINX_MAIN === chainId) {
    targetNodes = state.chainxMainNetNodes
  } else if (CHAINX_TEST === chainId) {
    targetNodes = state.chainxTestNetNodes
  } else {
    throw new Error(`Invalid chainId: ${chainId}`)
  }

  return targetNodes
}

const nodeSlice = createSlice({
  name: 'node',
  initialState,
  reducers: {
    addNode(
      state,
      {
        payload: {
          chainId,
          node: { name, url }
        }
      }
    ) {
      const targetNodes = findTargetNodes(state, chainId)
      const target = targetNodes.find(n => n.url === url)
      if (target) {
        return
      }

      const newNode = { name, url }
      targetNodes.push(newNode)
      setChainxInstances([url])

      let pre
      if (CHAINX_MAIN === chainId) {
        pre = state.currentChainXMainNetNode
        state.currentChainXMainNetNode = newNode
      } else if (CHAINX_TEST === chainId) {
        pre = state.currentChainXTestNetNode
        state.currentChainXTestNetNode = newNode
      }

      if ([CHAINX_MAIN, CHAINX_TEST].includes(chainId)) {
        window.sockets.broadcastEvent(events.NODE_CHANGE, {
          from: pre,
          to: newNode
        })
      }

      window.nodeStore.set(NODE_STORE_KEY, state)
    },
    setNodeDelay(state, { payload: { chainId, url, delay } }) {
      const targetNodes = findTargetNodes(state, chainId)
      const targetNode = targetNodes.find(node => node.url === url)
      const idx = targetNodes.findIndex(n => n.url === url)
      targetNodes.splice(idx, 1, { ...targetNode, delay })

      if (url === state.currentChainXTestNetNode.url) {
        state.currentChainXTestNetNode.delay = delay
      } else if (url === state.currentChainXMainNetNode.url) {
        state.currentChainXMainNetNode.delay = delay
      }
      window.nodeStore.set(NODE_STORE_KEY, state)
    },
    removeNode(state, { payload: { chainId, url } }) {
      const targetNodes = findTargetNodes(state, chainId)
      if (targetNodes.length <= 1) {
        return
      }

      const index = targetNodes.findIndex(n => n.url === url)
      if (index < 0) {
        return
      }

      targetNodes.splice(index, 1)
      removeInstance(url)

      let pre = null
      if (CHAINX_MAIN === chainId) {
        pre = state.currentChainXMainNetNode
        state.currentChainXMainNetNode = targetNodes[0] || null
      } else if (CHAINX_TEST === chainId) {
        pre = state.currentChainXTestNetNode
        state.currentChainXTestNetNode = targetNodes[0] || null
      }

      if ([CHAINX_MAIN, CHAINX_TEST].includes(chainId)) {
        window.sockets.broadcastEvent(events.NODE_CHANGE, {
          from: pre,
          to: targetNodes[0] || null
        })
      }

      window.nodeStore.set(NODE_STORE_KEY, state)

      // TODO: 处理不存在url的情况
    },
    setCurrentChainXNode(state, { payload: { chainId, url } }) {
      const targetNodes = findTargetNodes(state, chainId)
      if (!targetNodes) {
        return
      }

      const target = targetNodes.find(n => n.url === url)
      if (!target) {
        return
      }

      let pre
      if (CHAINX_MAIN === chainId) {
        pre = state.currentChainXMainNetNode
        state.currentChainXMainNetNode = target
      } else if (CHAINX_TEST === chainId) {
        pre = state.currentChainXTestNetNode
        state.currentChainXTestNetNode = target
      }

      window.nodeStore.set(NODE_STORE_KEY, state)
      window.sockets.broadcastEvent(events.NODE_CHANGE, {
        from: pre,
        to: target
      })
    }
  }
})

export const {
  addNode,
  removeNode,
  setCurrentChainXNode,
  setNodeDelay
} = nodeSlice.actions

export const chainxMainNetNodesSelector = state =>
  state.node.chainxMainNetNodes.map(node => {
    const isInit = [...mainNetInitNodes, ...testNetInitNodes].some(
      n => n.url === node.url
    )

    return {
      ...node,
      isInit
    }
  })
export const chainxTestNetNodesSelector = state =>
  state.node.chainxTestNetNodes.map(node => {
    const isInit = [...mainNetInitNodes, ...testNetInitNodes].some(
      n => n.url === node.url
    )

    return {
      ...node,
      isInit
    }
  })
export const currentChainXMainNetNodeSelector = state =>
  state.node.currentChainXMainNetNode
export const currentChainXTestNetNodeSelector = state =>
  state.node.currentChainXTestNetNode

export const chainxNodesSelector = createSelector(
  networkSelector,
  chainxMainNetNodesSelector,
  chainxTestNetNodesSelector,
  (network, mainNetNodes, testNetNodes) => {
    if (network === chainxNetwork.TEST) {
      return testNetNodes
    } else if (network === chainxNetwork.MAIN) {
      return mainNetNodes
    }
  }
)

export const currentChainxNodeSelector = createSelector(
  networkSelector,
  currentChainXMainNetNodeSelector,
  currentChainXTestNetNodeSelector,
  (network, mainNetNode, testNetNode) => {
    if (network === chainxNetwork.TEST) {
      return testNetNode
    } else if (network === chainxNetwork.MAIN) {
      return mainNetNode
    }
  }
)

export default nodeSlice.reducer
