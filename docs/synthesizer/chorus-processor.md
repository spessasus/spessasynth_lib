# ChorusProcessor

This module is responsible for applying the chorus effect to the audio.
It is used by the synthesizers, but it can also be used standalone.

## Implementation

The chorus effect comprises a channel splitter,
then a chain of delay nodes,
their delay times being driven by low frequency oscillators,
then getting merged back into a stereo output.

## Initialization

```ts
const chorusProcessor = new ChorusProcessor(context, config);
```

- context - the BaseAudioContext to use.
- config - an optional configuration. This can be changed later. Described below.

## Chorus configuration

### nodesAmount

The amount of delay nodes (for each channel) and the corresponding oscillators.

### defaultDelay

The initial delay, in seconds.

### delayVariation

The difference between delays in the delay nodes.

### stereoDifference

The difference of delays between two channels (added to the right channel).

### oscillatorFrequency

The initial delay time oscillator frequency, in Hz.

### oscillatorFrequencyVariation

The difference between frequencies of oscillators, in Hz.

### oscillatorGain

How much will oscillator alter the delay in delay nodes, in seconds.

## Properties

### config

The chorus configuration object, described above.

### update

Updates the chorus with a given config.

```ts
chorusProcessor.update(config);
```

- config - the chorus configuration object, described above. It can be partial.

### delete

Disconnects and deletes the chorus effect.

### connect, disconnect

Mirror the regular WebAudio API connecting and disconnecting functions.
