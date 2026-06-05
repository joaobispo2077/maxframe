import { Field, NativeSelect } from '@chakra-ui/react';

type OutputFormatSelectProps = {
  value: 'mp3' | 'mp4';
  onChange: (mode: 'mp3' | 'mp4') => void;
};

export function OutputFormatSelect({
  value,
  onChange,
}: OutputFormatSelectProps) {
  return (
    <Field.Root>
      <Field.Label htmlFor="output-format">Output format</Field.Label>
      <NativeSelect.Root colorPalette="purple">
        <NativeSelect.Field
          id="output-format"
          value={value}
          onChange={(e) => onChange(e.target.value as 'mp3' | 'mp4')}
          bg="blackAlpha.400"
          borderColor="border"
          fontSize="sm"
          _focusVisible={{
            borderColor: 'purple.400',
            boxShadow: '0 0 0 1px var(--chakra-colors-purple-400)',
          }}
        >
          <option value="mp4">MP4 (best video)</option>
          <option value="mp3">MP3 (best audio)</option>
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>
  );
}
