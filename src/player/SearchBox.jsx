import React, { useState, useEffect } from 'react';

// Win98 sunken search field. Submits on Enter; `initial` mirrors the active search.
const SearchBox = ({ onSearch, initial = '', label, className = '' }) => {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <form
      className={`wmp-search ${className}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = value.trim();
        if (query) onSearch(query);
      }}
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={label}
        aria-label={label}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      <button type="submit" className="wmp-search-go" aria-label="Search">
        <span className="toolbar-icon toolbar-icon-search" aria-hidden="true" />
      </button>
    </form>
  );
};

export default SearchBox;
