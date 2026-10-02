import { describe, expect, it } from 'vitest'
import { InvalidClientError } from '@/domain/oauth/errors/invalid-client.error'
import { HttpsClientMetadata, isPrivateAddress } from '@/infra/oauth/https-client-metadata.adapter'

describe('HttpsClientMetadata', () => {
  it('refuses a client_id that is not a canonical https URL with a path', async () => {
    const source = new HttpsClientMetadata()

    for (const clientId of [
      'not a url',
      'http://client.example.com/client.json',
      'https://client.example.com',
      'https://client.example.com/',
      'https://client.example.com/client.json?x=1',
      'https://client.example.com/client.json#top',
      'https://user:pass@client.example.com/client.json',
      'https://client.example.com/a/../client.json',
      'https://CLIENT.example.com/client.json',
    ]) {
      await expect(source.read(clientId), clientId).rejects.toBeInstanceOf(InvalidClientError)
    }
  })

  it('refuses to fetch from this machine or its network, whatever the name says', async () => {
    const source = new HttpsClientMetadata()

    for (const clientId of [
      'https://localhost/client.json',
      'https://127.0.0.1/client.json',
      'https://10.0.0.1/client.json',
      'https://[::1]/client.json',
    ]) {
      await expect(source.read(clientId), clientId).rejects.toThrow(
        /private address|could not be read/,
      )
    }
  })

  it('knows the private, loopback, link-local and mapped ranges from public ones', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '::1',
      'fe80::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(address), address).toBe(true)
    }

    for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(address), address).toBe(false)
    }
  })
})
