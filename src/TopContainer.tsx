import React, { useRef } from 'react'
import { StyleSheet } from 'react-native'
import {
  PanGestureHandler,
  GestureDetector,
  PanGestureHandlerGestureEvent,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  Extrapolate,
  interpolate,
  useAnimatedGestureHandler,
  withDecay,
  GestureHandlers,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated'

import { scrollToImpl } from './helpers'
import { useOnScroll, useSnap, useTabsContext } from './hooks'
import { CollapsibleProps } from './types'

type TabBarContainerProps = Pick<
  CollapsibleProps,
  'headerContainerStyle' | 'cancelTranslation' | 'children'
>

export const TopContainer: React.FC<TabBarContainerProps> = ({
  children,
  headerContainerStyle,
  cancelTranslation,
}) => {
  const {
    headerTranslateY,
    revealHeaderOnScroll,
    isSlidingTopContainer,
    scrollYCurrent,
    contentInset,
    refMap,
    tabNames,
    index,
    headerScrollDistance,
  } = useTabsContext()

  const isSlidingTopContainerPrev = useSharedValue(false)
  const isTopContainerOutOfSync = useSharedValue(false)

  const tryToSnap = useSnap()
  const onScroll = useOnScroll()

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: headerTranslateY.value,
        },
      ],
    }
  }, [revealHeaderOnScroll])

  const syncActiveTabScroll = (position: number) => {
    'worklet'

    scrollToImpl(refMap[tabNames.value[index.value]], 0, position, false)
  }

  const ctx = useRef({ startY: 0 });
  const gestureHandler = Gesture.Pan().onChange((event) => {
      if (!isSlidingTopContainer.value) {
        ctx.current.startY = scrollYCurrent.value
        isSlidingTopContainer.value = true
        return
      }

      scrollYCurrent.value = interpolate(
        -event.translationY + ctx.current.startY,
        [0, headerScrollDistance.value],
        [0, headerScrollDistance.value],
        Extrapolate.CLAMP
      )
  }).onEnd((event) => {
        if (!isSlidingTopContainer.value) return

      ctx.current.startY = 0
      scrollYCurrent.value = withDecay(
        {
          velocity: -event.velocityY,
          clamp: [0, headerScrollDistance.value],
          // deceleration: IS_IOS ? 0.998 : 0.99,
        },
        (finished) => {
          console.log(
            'finished = ',
            finished,
            ', headerScrollDistance.value = ',
            headerScrollDistance.value
          )
          isSlidingTopContainer.value = false
          isTopContainerOutOfSync.value = finished || false
        }
      )
  });

  //Keeps updating the active tab scroll as we scroll on the top container element
  useAnimatedReaction(
    () => scrollYCurrent.value - contentInset.value,
    (nextPosition, previousPosition) => {
      if (nextPosition !== previousPosition && isSlidingTopContainer.value) {
        syncActiveTabScroll(nextPosition)
        onScroll()
      }
    }
  )

  /* Syncs the scroll of the active tab once we complete the scroll gesture 
  on the header and the decay animation completes with success
   */
  useAnimatedReaction(
    () => {
      console.log(
        'abc = ',
        isSlidingTopContainer.value !== isSlidingTopContainerPrev.value &&
          isTopContainerOutOfSync.value
      )
      return (
        isSlidingTopContainer.value !== isSlidingTopContainerPrev.value &&
        isTopContainerOutOfSync.value
      )
    },
    (result) => {
      isSlidingTopContainerPrev.value = isSlidingTopContainer.value

      if (!result) return
      if (isSlidingTopContainer.value === true) return

      syncActiveTabScroll(scrollYCurrent.value - contentInset.value)
      onScroll()
      tryToSnap()

      isTopContainerOutOfSync.value = false
    }
  )

  return (
    <Animated.View
      style={[
        styles.container,
        headerContainerStyle,
        !cancelTranslation && animatedStyles,
      ]}
    >
      <GestureHandlerRootView>
      <GestureDetector gesture={gestureHandler}>
        <Animated.View>{children?.[0]}</Animated.View>
      </GestureDetector>
      </GestureHandlerRootView>
      <Animated.View>{children?.[1]}</Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
    width: '100%',
    backgroundColor: 'white',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
})
