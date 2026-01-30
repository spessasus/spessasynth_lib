# ReverbProcessor

This module is responsible for applying the reverb effect to the audio.
It is used by the synthesizers, but it can also be used standalone.

## Implementation

The reverb effect is implemented with a ConvolverNode.
This may be subject to change.

## Initialization

```ts
const reverbProcessor = new ReverbProcessor(context, config);
```

- context - the BaseAudioContext to use.
- config - an optional configuration. This can be changed later. Described below.

## Reverb configuration

### impulseResponse

The impulse response for the reverb, an `AudioBuffer`. Pass undefined to use default one.

## Properties

### config

The reverb configuration object, described above.

### update

Updates the reverb with a given config.

```ts
reverbProcessor.update(config);
```

- config - the reverb configuration object, described above. It can be partial.

### delete

Disconnects and deletes the reverb effect.

### connect, disconnect

Mirror the regular WebAudio API connecting and disconnecting functions.
